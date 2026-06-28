"""High-frequency market readout for the live demo.

Supply/demand are anchored to the REAL meter-reading totals the orchestrator
sees, then resampled at ~1.4s with an intraday solar/load curve and light noise
so the graph visibly breathes and the clearing price carries real volatility.
The raw 450-node sums are otherwise too smooth and too slow (meters tick ~10s)
to make a compelling live chart.

This is the authoritative graph driver. The Spark `market-state` consumer only
notes warmup for /health — it emits a single windowed point per minute, far too
sparse to drive the view (see kafka_consumers._run_market_state)."""
import asyncio
import logging
import math
import random
import time

from config import BASE_PRICE, clamp_price, now_ms
from event_bus import bus
from state import STATE

logger = logging.getLogger(__name__)

# Seconds for one simulated "day" to elapse. Short on purpose so the supply/
# demand curve is visibly moving on the live chart within a few seconds.
DAY_PERIOD_S = 45.0


def _price_from(supply: float, demand: float) -> float:
    if supply <= 0:
        return clamp_price(BASE_PRICE * 2)
    return clamp_price(BASE_PRICE * (demand / supply))


async def market_aggregator_task():
    rng = random.Random(11)
    t0 = time.monotonic()
    while True:
        await asyncio.sleep(1.4)
        # Drive continuously off real readings — we intentionally do NOT defer to
        # Spark here (its 1/min cadence would flatten the chart). Honour pause.
        if STATE.paused or not STATE.readings:
            continue

        base_supply, base_demand = STATE.supply_demand()
        if base_supply <= 0 and base_demand <= 0:
            continue

        # Intraday modulation: supply follows a solar bell (zero overnight, peak
        # midday); demand a gentler load curve. Phase advances one day / DAY_PERIOD_S.
        phase = ((time.monotonic() - t0) / DAY_PERIOD_S) % 1.0
        ang = phase * 2.0 * math.pi
        supply_curve = 0.55 + 0.60 * max(0.0, math.sin(ang))         # ~0.55 .. 1.15
        demand_curve = 0.80 + 0.40 * (0.5 - 0.5 * math.cos(ang))     # ~0.80 .. 1.20
        supply = round(max(1.0, base_supply * supply_curve) * rng.uniform(0.95, 1.05), 2)
        demand = round(max(1.0, base_demand * demand_curve) * rng.uniform(0.95, 1.05), 2)

        bus.publish({
            "type": "market", "ts": now_ms(), "supply": supply, "demand": demand,
            "source": "orchestrator",
        })

        # Price tracks the supply/demand balance, with jitter for visible volatility.
        price = clamp_price(_price_from(supply, demand) * rng.uniform(0.96, 1.04))
        prev = STATE.last_price or price
        delta = round(((price - prev) / prev) * 100, 1) if prev else 0.0
        STATE.last_price = round(price, 2)
        bus.publish({
            "type": "price", "ts": now_ms(), "price": round(price, 2), "deltaPct": delta,
            "trend": "up" if delta > 0.2 else "down" if delta < -0.2 else "flat",
            "source": "orchestrator",
        })
