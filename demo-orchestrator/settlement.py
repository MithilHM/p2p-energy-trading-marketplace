"""Match → transfer → on-chain settlement → ledger.

Every match (ambient or spotlight) emits a `match` + `transfer`. Ambient trades
then create a real on-chain escrow (one createTrade tx) and append a ledger row.
The narrated spotlight trade is taken all the way through confirm + release via
the blockchain service's /trade/settle-demo, so the dialog's "the contract pays
the seller" beat is a genuine end-to-end settlement.
"""
import asyncio
import logging

import httpx

from config import BLOCKCHAIN_URL, HARDHAT_ADDRESSES, PRICE_PER_UNIT_WEI, AUTO_SETTLE, now_ms
from event_bus import bus
from state import STATE

logger = logging.getLogger(__name__)

settle_queue: "asyncio.Queue[dict]" = asyncio.Queue(maxsize=500)

WEI_PER_ETH = 10 ** 18


def _eth_index(node_id: str) -> int:
    node = STATE.roster_by_id.get(node_id)
    if node and "eth_account_index" in node:
        return int(node["eth_account_index"]) % 20 or 1
    return (abs(hash(node_id)) % 19) + 1


def _transfer_event(trade: dict, spotlight: bool) -> dict:
    return {
        "type": "transfer", "ts": now_ms(), "tradeId": trade["trade_id"],
        "fromId": trade["seller"], "toId": trade["buyer"],
        "units": trade["units"], "durationMs": 3200 if spotlight else 2600,
        "spotlight": spotlight,
    }


def _match_event(trade: dict, spotlight: bool) -> dict:
    return {
        "type": "match", "ts": now_ms(), "tradeId": trade["trade_id"],
        "sellerId": trade["seller"], "buyerId": trade["buyer"],
        "units": trade["units"], "price": trade["price"], "spotlight": spotlight,
    }


def _record_ledger(trade: dict, tx_hash: str, amount_eth: float, spotlight: bool):
    row = {
        "type": "ledger", "ts": now_ms(), "tradeId": trade["trade_id"], "txHash": tx_hash,
        "sellerId": trade["seller"], "buyerId": trade["buyer"], "units": trade["units"],
        "amountEth": amount_eth, "priceUsd": trade["price"], "spotlight": spotlight,
    }
    STATE.ledger.insert(0, row)
    STATE.ledger = STATE.ledger[:60]
    STATE.ledger_total_eth = round(STATE.ledger_total_eth + amount_eth, 8)
    STATE.ledger_count += 1
    bus.publish(row)


def emit_match(trade: dict, spotlight: bool, queue_settle: bool = True):
    """Surface a match + transfer (from the asyncio loop). Ambient matches are
    queued for on-chain escrow creation."""
    bus.publish(_match_event(trade, spotlight))
    bus.publish(_transfer_event(trade, spotlight))
    if spotlight:
        # escrow 'created' placeholder; full lifecycle driven by /demo/step
        bus.publish({
            "type": "settlement", "ts": now_ms(), "tradeId": trade["trade_id"],
            "stage": "created", "txHash": "0x" + "0" * 12, "amountEth": 0.0,
            "sellerId": trade["seller"], "buyerId": trade["buyer"], "spotlight": True,
        })
    elif queue_settle and AUTO_SETTLE:
        try:
            settle_queue.put_nowait(trade)
        except asyncio.QueueFull:
            pass


def emit_match_threadsafe(trade: dict, spotlight: bool):
    if STATE.loop:
        STATE.loop.call_soon_threadsafe(emit_match, trade, spotlight)


async def _create_escrow(client: httpx.AsyncClient, trade: dict):
    """Ambient settlement: one real createTrade tx (Option A)."""
    seller_addr = HARDHAT_ADDRESSES[_eth_index(trade["seller"])]
    units = max(1, round(trade["units"]))
    try:
        resp = await client.post(f"{BLOCKCHAIN_URL}/trade/settle", json={
            "seller": seller_addr, "units": units,
            "price_per_unit_wei": PRICE_PER_UNIT_WEI, "auto_settle": False,
        }, timeout=15.0)
        data = resp.json()
        tx_hash = data.get("tx_hash", "0x" + "0" * 12)
        amount_eth = units * PRICE_PER_UNIT_WEI / WEI_PER_ETH
        bus.publish({
            "type": "settlement", "ts": now_ms(), "tradeId": trade["trade_id"],
            "stage": "created", "txHash": tx_hash, "amountEth": amount_eth,
            "sellerId": trade["seller"], "buyerId": trade["buyer"], "spotlight": False,
        })
        _record_ledger(trade, tx_hash, amount_eth, False)
    except Exception as e:
        logger.warning(f"escrow create failed for {trade['trade_id']}: {e}")
        bus.publish({
            "type": "settlement", "ts": now_ms(), "tradeId": trade["trade_id"],
            "stage": "failed", "txHash": "", "amountEth": 0.0,
            "sellerId": trade["seller"], "buyerId": trade["buyer"], "spotlight": False,
        })


async def settle_spotlight():
    """Drive the spotlight trade fully through the contract (Option B)."""
    sp = STATE.spotlight
    if not sp:
        return
    seller_idx = _eth_index(sp["seller"])
    units = max(1, round(sp["units"]))
    amount_eth = units * PRICE_PER_UNIT_WEI / WEI_PER_ETH
    trade = {"trade_id": sp["trade_id"], "seller": sp["seller"], "buyer": sp["buyer"],
             "units": units, "price": sp["price"]}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{BLOCKCHAIN_URL}/trade/settle-demo", json={
                "seller_index": seller_idx, "units": units,
                "price_per_unit_wei": PRICE_PER_UNIT_WEI,
            }, timeout=40.0)
            data = resp.json()
            tx_hash = data.get("settle_tx_hash") or data.get("tx_hash", "0x" + "0" * 12)
            for stage in ("created", "confirmed", "released"):
                bus.publish({
                    "type": "settlement", "ts": now_ms(), "tradeId": sp["trade_id"],
                    "stage": stage, "txHash": tx_hash, "amountEth": amount_eth,
                    "sellerId": sp["seller"], "buyerId": sp["buyer"], "spotlight": True,
                })
                await asyncio.sleep(0.6)
            _record_ledger(trade, tx_hash, amount_eth, True)
        except Exception as e:
            logger.warning(f"spotlight settle failed: {e}")
            bus.publish({
                "type": "settlement", "ts": now_ms(), "tradeId": sp["trade_id"],
                "stage": "failed", "txHash": "", "amountEth": 0.0,
                "sellerId": sp["seller"], "buyerId": sp["buyer"], "spotlight": True,
            })


async def settlement_worker():
    """Serialize ambient escrow creation so block-paced txs don't pile up."""
    async with httpx.AsyncClient() as client:
        while True:
            trade = await settle_queue.get()
            try:
                await _create_escrow(client, trade)
            except Exception as e:
                logger.error(f"settlement_worker error: {e}")
            await asyncio.sleep(0.2)
