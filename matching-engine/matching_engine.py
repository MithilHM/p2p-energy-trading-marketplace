from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
from kafka import KafkaProducer
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


# In-memory storage
sell_orders: List[SellOrder] = []
buy_orders: List[BuyOrder] = []
trades: List[Trade] = []
trade_counter = 0

# Kafka producer for trade notifications
kafka_producer = None


def init_kafka(kafka_broker):
    """Initialize Kafka producer"""
    global kafka_producer
    try:
        kafka_producer = KafkaProducer(
            bootstrap_servers=[kafka_broker],
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        logger.info(f"Kafka producer initialized: {kafka_broker}")
    except Exception as e:
        logger.error(f"Failed to initialize Kafka: {e}")


def match_orders():
    """match_orders: Match buy and sell orders"""
    global trade_counter

    matched = []

    for sell_order in sell_orders[:]:
        for buy_order in buy_orders[:]:
            # Check if price matches (buyer willing to pay >= seller asking)
            if buy_order.max_price_per_unit >= sell_order.price_per_unit:
                # Calculate units traded (min of both orders)
                units_traded = min(sell_order.energy_units, buy_order.energy_units)

                # Create trade at sell price (seller's asking price)
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

                # Update orders
                sell_order.energy_units -= units_traded
                buy_order.energy_units -= units_traded

                logger.info(
                    f"[MATCH] {sell_order.seller_id} → {buy_order.buyer_id}: "
                    f"{units_traded} units @ {sell_order.price_per_unit}/unit"
                )

                # Publish to Kafka
                if kafka_producer:
                    kafka_producer.send("trades", trade.dict())

                # Remove if fully matched
                if sell_order.energy_units <= 0:
                    sell_orders.remove(sell_order)
                if buy_order.energy_units <= 0:
                    buy_orders.remove(buy_order)
                    break

    return matched


def execute_trade(trade: Trade):
    """execute_trade: Record and publish trade"""
    trades.append(trade)
    if kafka_producer:
        kafka_producer.send("trades", trade.dict())
    logger.info(f"Trade executed: {trade.trade_id}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sell")
def post_sell(order: SellOrder):
    """POST /sell: Create a sell order"""
    if order.timestamp is None:
        order.timestamp = datetime.utcnow().isoformat() + "Z"

    sell_orders.append(order)
    logger.info(f"[SELL] {order.seller_id}: {order.energy_units} units @ {order.price_per_unit}/unit")

    # Try to match
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

    buy_orders.append(order)
    logger.info(f"[BUY] {order.buyer_id}: {order.energy_units} units @ max {order.max_price_per_unit}/unit")

    # Try to match
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
    return {
        "total_trades": len(trades),
        "trades": trades
    }


@app.get("/orders")
def get_orders():
    """GET /orders: Get pending orders"""
    return {
        "pending_sell_orders": len(sell_orders),
        "pending_buy_orders": len(buy_orders),
        "sell_orders": sell_orders,
        "buy_orders": buy_orders
    }


@app.get("/trades/{trade_id}")
def get_trade(trade_id: str):
    """GET /trades/{trade_id}: Get specific trade"""
    for trade in trades:
        if trade.trade_id == trade_id:
            return trade
    raise HTTPException(status_code=404, detail="Trade not found")


@app.on_event("startup")
async def startup_event():
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    init_kafka(kafka_broker)


@app.on_event("shutdown")
async def shutdown_event():
    if kafka_producer:
        kafka_producer.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
