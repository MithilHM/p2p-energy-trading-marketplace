"""Spark-independent market readout. Until Spark's `market-state` warms up
(~2-3 min), this derives supply/demand directly from the raw meter readings the
orchestrator already sees, so there is never dead air. Once Spark is warm the
Kafka consumer drives the official numbers and this goes quiet."""
import asyncio
import logging

from config import BASE_PRICE, clamp_price, now_ms
from event_bus import bus
from state import STATE

logger = logging.getLogger(__name__)


def _price_from(supply: float, demand: float) -> float:
    if supply <= 0:
        return clamp_price(BASE_PRICE * 2)
    return clamp_price(BASE_PRICE * (demand / supply))


async def market_aggregator_task():
    while True:
        await asyncio.sleep(1.4)
        if STATE.spark_warm or not STATE.readings:
            continue
        supply, demand = STATE.supply_demand()
        bus.publish({
            "type": "market", "ts": now_ms(), "supply": supply, "demand": demand,
            "source": "orchestrator",
        })
        price = _price_from(supply, demand)
        prev = STATE.last_price or price
        delta = round(((price - prev) / prev) * 100, 1) if prev else 0.0
        STATE.last_price = price
        bus.publish({
            "type": "price", "ts": now_ms(), "price": round(price, 2), "deltaPct": delta,
            "trend": "up" if delta > 0.2 else "down" if delta < -0.2 else "flat",
            "source": "orchestrator",
        })
