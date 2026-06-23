"""Turns live meter readings into matching-engine orders so the market actually
clears. Producers with output post sells near the clearing price; consumers
post buys slightly above it, so `buy.max >= sell.ask` and matches occur. Matches
themselves arrive back via the Kafka `trades` consumer (single source)."""
import asyncio
import logging
import random

import httpx

from config import MATCHING_URL, AUTO_TRADE, now_ms
from event_bus import bus
from state import STATE

logger = logging.getLogger(__name__)

MAX_PER_SIDE = 6


async def _post(client, path, payload):
    try:
        await client.post(f"{MATCHING_URL}{path}", json=payload, timeout=5.0)
        return True
    except Exception as e:
        logger.debug(f"order post {path} failed: {e}")
        return False


async def auto_trader_task():
    if not AUTO_TRADE:
        return
    rng = random.Random(7)
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(6.0)
            if STATE.paused or not STATE.readings:
                continue
            price = STATE.last_price or 10.0

            producers = [nid for nid, r in STATE.readings.items()
                         if r["role"] == "producer" and r["energy"] > 0.5]
            consumers = [nid for nid, r in STATE.readings.items()
                         if r["role"] == "consumer" and r["energy"] > 0.5]
            rng.shuffle(producers)
            rng.shuffle(consumers)

            for nid in producers[:MAX_PER_SIDE]:
                units = round(STATE.readings[nid]["energy"], 2)
                ask = round(price * rng.uniform(0.92, 1.02), 2)
                if await _post(client, "/sell", {
                    "seller_id": nid, "energy_units": units, "price_per_unit": ask,
                }):
                    bus.publish({"type": "order", "ts": now_ms(), "side": "sell",
                                 "nodeId": nid, "units": units, "price": ask})

            for nid in consumers[:MAX_PER_SIDE]:
                units = round(STATE.readings[nid]["energy"], 2)
                bid = round(price * rng.uniform(1.02, 1.15), 2)
                if await _post(client, "/buy", {
                    "buyer_id": nid, "energy_units": units, "max_price_per_unit": bid,
                }):
                    bus.publish({"type": "order", "ts": now_ms(), "side": "buy",
                                 "nodeId": nid, "units": units, "price": bid})
