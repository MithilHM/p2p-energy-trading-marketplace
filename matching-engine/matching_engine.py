from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import threading
import time
from kafka import KafkaProducer
from kafka.errors import KafkaError
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Smallest residual quantity considered "fully filled" (guards float dust)
EPSILON = 1e-9

app = FastAPI(title="Matching Engine", version="1.0.0")


# Data Models
class SellOrder(BaseModel):
    seller_id: str
    energy_units: float
    price_per_unit: float
    timestamp: Optional[str] = None


class BuyOrder(BaseModel):
    buyer_id: str
    energy_units: float
    max_price_per_unit: float
    timestamp: Optional[str] = None


class Trade(BaseModel):
    trade_id: str
    seller: str
    buyer: str
    units: float
    price: float
    timestamp: str


# In-memory storage. All access is guarded by `state_lock` because FastAPI
# runs sync endpoints in a threadpool, so requests can run concurrently.
sell_orders: List[SellOrder] = []
buy_orders: List[BuyOrder] = []
trades: List[Trade] = []
trade_counter = 0
state_lock = threading.Lock()

# Kafka producer for trade notifications
kafka_producer = None


def init_kafka(kafka_broker, max_attempts=0):
    """Initialize Kafka producer with retry/backoff.

    max_attempts=0 means retry forever (the service is useless without Kafka).
    """
    global kafka_producer
    attempt = 0
    delay = 2
    while True:
        attempt += 1
        try:
            kafka_producer = KafkaProducer(
                bootstrap_servers=[kafka_broker],
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                retries=3
            )
            logger.info(f"Kafka producer initialized: {kafka_broker}")
            return
        except Exception as e:
            logger.warning(f"Kafka init attempt {attempt} failed: {e}")
            if max_attempts and attempt >= max_attempts:
                logger.error("Giving up on Kafka init")
                return
            time.sleep(delay)
            delay = min(delay * 2, 30)


def _publish_trade(trade: Trade):
    """Publish a trade to Kafka; never let a broker hiccup break the API."""
    if not kafka_producer:
        return
    try:
        kafka_producer.send("trades", trade.dict())
    except KafkaError as e:
        logger.error(f"Failed to publish trade {trade.trade_id} to Kafka: {e}")


def match_orders():
    """match_orders: Match buy and sell orders.

    Caller MUST hold `state_lock`. This does not mutate the order lists while
    iterating: it adjusts remaining quantities in place, then rebuilds both
    lists once at the end, dropping any order filled below EPSILON.
    """
    global trade_counter

    matched = []

    for sell_order in sell_orders:
        if sell_order.energy_units <= EPSILON:
            continue
        for buy_order in buy_orders:
            if buy_order.energy_units <= EPSILON:
                continue
            if sell_order.energy_units <= EPSILON:
                break  # current sell order exhausted; move to next seller
            # Buyer willing to pay >= seller's asking price
            if buy_order.max_price_per_unit >= sell_order.price_per_unit:
                units_traded = round(min(sell_order.energy_units, buy_order.energy_units), 6)

                trade_id = f"T{str(trade_counter).zfill(6)}"
                trade_counter += 1
                trade = Trade(
                    trade_id=trade_id,
                    seller=sell_order.seller_id,
                    buyer=buy_order.buyer_id,
                    units=units_traded,
                    price=sell_order.price_per_unit,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )

                trades.append(trade)
                matched.append(trade)

                # Reduce remaining quantities (rounded to avoid float dust)
                sell_order.energy_units = round(sell_order.energy_units - units_traded, 6)
                buy_order.energy_units = round(buy_order.energy_units - units_traded, 6)

                logger.info(
                    f"[MATCH] {sell_order.seller_id} → {buy_order.buyer_id}: "
                    f"{units_traded} units @ {sell_order.price_per_unit}/unit"
                )

                _publish_trade(trade)

    # Rebuild lists once, dropping fully-filled orders
    sell_orders[:] = [o for o in sell_orders if o.energy_units > EPSILON]
    buy_orders[:] = [o for o in buy_orders if o.energy_units > EPSILON]

    return matched


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sell")
def post_sell(order: SellOrder):
    """POST /sell: Create a sell order"""
    if order.timestamp is None:
        order.timestamp = datetime.utcnow().isoformat() + "Z"

    logger.info(f"[SELL] {order.seller_id}: {order.energy_units} units @ {order.price_per_unit}/unit")

    with state_lock:
        sell_orders.append(order)
        matched_trades = match_orders()

    return {
        "status": "order_created",
        "seller": order.seller_id,
        "units": order.energy_units,
        "price": order.price_per_unit,
        "matches": len(matched_trades),
        "trades": matched_trades
    }


@app.post("/buy")
def post_buy(order: BuyOrder):
    """POST /buy: Create a buy order"""
    if order.timestamp is None:
        order.timestamp = datetime.utcnow().isoformat() + "Z"

    logger.info(f"[BUY] {order.buyer_id}: {order.energy_units} units @ max {order.max_price_per_unit}/unit")

    with state_lock:
        buy_orders.append(order)
        matched_trades = match_orders()

    return {
        "status": "order_created",
        "buyer": order.buyer_id,
        "units": order.energy_units,
        "max_price": order.max_price_per_unit,
        "matches": len(matched_trades),
        "trades": matched_trades
    }


@app.get("/matches")
def get_matches():
    """GET /matches: Get all executed trades"""
    with state_lock:
        return {
            "total_trades": len(trades),
            "trades": list(trades)
        }


@app.get("/orders")
def get_orders():
    """GET /orders: Get pending orders"""
    with state_lock:
        return {
            "pending_sell_orders": len(sell_orders),
            "pending_buy_orders": len(buy_orders),
            "sell_orders": list(sell_orders),
            "buy_orders": list(buy_orders)
        }


@app.get("/trades/{trade_id}")
def get_trade(trade_id: str):
    """GET /trades/{trade_id}: Get specific trade"""
    with state_lock:
        for trade in trades:
            if trade.trade_id == trade_id:
                return trade
    raise HTTPException(status_code=404, detail="Trade not found")


@app.on_event("startup")
async def startup_event():
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    # Connect in the background so the API stays responsive even if the
    # broker is briefly unavailable; trades simply aren't published until ready.
    threading.Thread(target=init_kafka, args=(kafka_broker,), daemon=True).start()


@app.on_event("shutdown")
async def shutdown_event():
    if kafka_producer:
        kafka_producer.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
