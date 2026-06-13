from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json
import time
from kafka import KafkaConsumer
from collections import deque
import threading
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pricing Engine", version="1.0.0")


# Data Models
class MarketState(BaseModel):
    supply: float
    demand: float
    surplus: float
    timestamp: str


class PriceQuote(BaseModel):
    current_price: float
    supply: float
    demand: float
    price_trend: str
    timestamp: str


# Configuration
BASE_PRICE = 10.0  # Base price per kWh in currency units
PRICE_HISTORY_SIZE = 100

# Market state tracking
current_market_state: Optional[MarketState] = None
price_history: deque = deque(maxlen=PRICE_HISTORY_SIZE)
lock = threading.Lock()


def calculate_price(supply: float, demand: float) -> float:
    """
    calculate_price: Dynamic price calculation
    price = base_price * (demand / supply)

    - High demand, low supply -> high price
    - Low demand, high supply -> low price
    """
    if supply <= 0:
        return BASE_PRICE * 2  # Emergency pricing

    # Ensure minimum price
    price = BASE_PRICE * (demand / supply)
    return max(price, BASE_PRICE * 0.5)  # Min price is 50% of base


def get_price_trend(current_price: float) -> str:
    """Determine price trend from history"""
    if len(price_history) < 2:
        return "neutral"

    recent_price = price_history[-1]
    prev_price = price_history[-2] if len(price_history) >= 2 else recent_price

    if current_price > prev_price * 1.05:
        return "rising"
    elif current_price < prev_price * 0.95:
        return "falling"
    else:
        return "stable"


def consume_market_state(kafka_broker: str):
    """Consume market state updates from Kafka"""
    global current_market_state

    # Create the consumer with retry/backoff so a not-yet-ready broker
    # doesn't kill the background thread.
    delay = 2
    attempt = 0
    consumer = None
    while consumer is None:
        attempt += 1
        try:
            consumer = KafkaConsumer(
                "market-state",
                bootstrap_servers=[kafka_broker],
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="latest",
                group_id="pricing-engine"
            )
        except Exception as e:
            logger.warning(f"Kafka consumer init attempt {attempt} failed: {e}")
            time.sleep(delay)
            delay = min(delay * 2, 30)

    logger.info("Consuming market state from Kafka...")

    for message in consumer:
        try:
            data = message.value
            with lock:
                current_market_state = MarketState(
                    supply=data["supply"],
                    demand=data["demand"],
                    surplus=data["surplus"],
                    timestamp=data["timestamp"]
                )

                # Calculate and store price
                current_price = calculate_price(data["supply"], data["demand"])
                price_history.append(current_price)

                logger.info(
                    f"[PRICE] Supply: {data['supply']:.2f}, "
                    f"Demand: {data['demand']:.2f}, "
                    f"Price: ${current_price:.2f}/kWh"
                )

        except Exception as e:
            logger.error(f"Error processing market state: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/current-price")
def get_current_price():
    """GET /current-price: Get current market price"""
    with lock:
        if current_market_state is None:
            return {
                "current_price": BASE_PRICE,
                "supply": 0,
                "demand": 0,
                "price_trend": "unknown",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "status": "no_market_data"
            }

        current_price = calculate_price(
            current_market_state.supply,
            current_market_state.demand
        )
        trend = get_price_trend(current_price)

        return PriceQuote(
            current_price=round(current_price, 4),
            supply=round(current_market_state.supply, 2),
            demand=round(current_market_state.demand, 2),
            price_trend=trend,
            timestamp=datetime.utcnow().isoformat() + "Z"
        ).dict()


@app.get("/price-history")
def get_price_history(limit: int = 50):
    """GET /price-history: Get price history"""
    with lock:
        history = list(price_history)[-limit:]
        return {
            "prices": history,
            "count": len(history),
            "current": history[-1] if history else BASE_PRICE
        }


@app.get("/analytics")
def get_analytics():
    """GET /analytics: Price analytics"""
    with lock:
        if len(price_history) == 0:
            return {
                "min_price": BASE_PRICE,
                "max_price": BASE_PRICE,
                "avg_price": BASE_PRICE,
                "current_price": BASE_PRICE,
                "volatility": 0
            }

        prices = list(price_history)
        min_price = min(prices)
        max_price = max(prices)
        avg_price = sum(prices) / len(prices)
        volatility = ((max_price - min_price) / avg_price * 100) if avg_price > 0 else 0

        return {
            "min_price": round(min_price, 4),
            "max_price": round(max_price, 4),
            "avg_price": round(avg_price, 4),
            "current_price": round(prices[-1], 4),
            "volatility_percent": round(volatility, 2),
            "samples": len(prices)
        }


@app.on_event("startup")
async def startup_event():
    """Start Kafka consumer in background thread"""
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    consumer_thread = threading.Thread(
        target=consume_market_state,
        args=(kafka_broker,),
        daemon=True
    )
    consumer_thread.start()
    logger.info("Pricing engine started")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
