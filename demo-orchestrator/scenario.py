"""The /demo control surface — the brain the RUN button drives. Produces a
clean, deterministic spotlight trade for the narrated beats, independent of the
busy ambient market."""
import logging

import httpx

from config import MATCHING_URL, now_ms
from event_bus import bus
from settlement import emit_match, settle_spotlight
from state import STATE

logger = logging.getLogger(__name__)


def run():
    """Begin/continue streaming. Streams are always live; just un-pause."""
    STATE.paused = False
    return {"status": "running"}


def reset():
    STATE.ledger = []
    STATE.ledger_total_eth = 0.0
    STATE.ledger_count = 0
    STATE.energy_traded_kwh = 0.0
    STATE.grid_import_cost = 0.0
    STATE.consumer_savings = 0.0
    STATE.producer_earnings = 0.0
    STATE.emitted_trades = set()
    STATE.spotlight = None
    STATE.paused = False
    return {"status": "reset"}


def pause():
    STATE.paused = True
    return {"status": "paused"}


def resume():
    STATE.paused = False
    return {"status": "resumed"}


def _pick_pair():
    producers = [n for n in STATE.roster if n["side"] == "producer"]
    consumers = [n for n in STATE.roster if n["side"] == "consumer"]
    if not producers or not consumers:
        return None, None
    seller = producers[len(producers) // 5]["id"]
    buyer = consumers[len(consumers) * 7 // 10]["id"]
    return seller, buyer


async def spotlight(seller_id=None, buyer_id=None, units=None, price=None):
    """Stage a clean, narratable match between one producer and one consumer.
    Emits the match/transfer/escrow-created directly (deterministic) and also
    places real orders for authenticity in the order book."""
    price = float(price) if price else (STATE.last_price or 10.0)
    units = float(units) if units else 30.0
    if not seller_id or not buyer_id:
        seller_id, buyer_id = _pick_pair()
    if not seller_id or not buyer_id:
        return {"status": "no_roster"}

    ask = round(price, 2)
    bid = round(price * 1.1, 2)
    trade_id = f"SPOT-{now_ms()}"

    # authenticity: place the orders (their own matches flow via Kafka)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{MATCHING_URL}/sell", json={
                "seller_id": seller_id, "energy_units": units, "price_per_unit": ask}, timeout=5.0)
            await client.post(f"{MATCHING_URL}/buy", json={
                "buyer_id": buyer_id, "energy_units": units, "max_price_per_unit": bid}, timeout=5.0)
    except Exception as e:
        logger.debug(f"spotlight order post failed (non-fatal): {e}")

    STATE.emitted_trades.add(trade_id)
    STATE.spotlight = {"trade_id": trade_id, "seller": seller_id, "buyer": buyer_id,
                       "units": units, "price": ask}
    # emit the crisp demonstrative match for the chosen pair
    emit_match({"trade_id": trade_id, "seller": seller_id, "buyer": buyer_id,
                "units": units, "price": ask}, spotlight=True, queue_settle=False)
    bus.publish({"type": "order", "ts": now_ms(), "side": "sell",
                 "nodeId": seller_id, "units": units, "price": ask})
    bus.publish({"type": "order", "ts": now_ms(), "side": "buy",
                 "nodeId": buyer_id, "units": units, "price": bid})
    return {"status": "spotlight", **STATE.spotlight}


async def step():
    """Advance the spotlight escrow fully: confirm + release on-chain."""
    if not STATE.spotlight:
        await spotlight()
    await settle_spotlight()
    return {"status": "settled", "trade": STATE.spotlight}
