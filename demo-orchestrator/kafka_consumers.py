"""Kafka consumers (daemon threads) that bridge the live pipeline into the demo
event stream. Single consumer group `demo-orchestrator`, latest offsets only."""
import json
import logging
import threading
import time

from kafka import KafkaConsumer

from config import KAFKA_BROKER, BASE_PRICE, clamp_price, now_ms
from event_bus import bus
from settlement import emit_match_threadsafe
from state import STATE

logger = logging.getLogger(__name__)


def _consumer(topic: str) -> KafkaConsumer:
    delay = 2
    attempt = 0
    while True:
        attempt += 1
        try:
            return KafkaConsumer(
                topic,
                bootstrap_servers=[KAFKA_BROKER],
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="latest",
                group_id="demo-orchestrator",
            )
        except Exception as e:
            logger.warning(f"kafka consumer[{topic}] init attempt {attempt} failed: {e}")
            time.sleep(delay)
            delay = min(delay * 2, 30)


def _price_from(supply: float, demand: float) -> float:
    if supply <= 0:
        return clamp_price(BASE_PRICE * 2)
    return clamp_price(BASE_PRICE * (demand / supply))


def _emit_price(price: float, source: str):
    prev = STATE.last_price or price
    delta = round(((price - prev) / prev) * 100, 1) if prev else 0.0
    STATE.last_price = price
    bus.publish_threadsafe({
        "type": "price", "ts": now_ms(), "price": round(price, 2), "deltaPct": delta,
        "trend": "up" if delta > 0.2 else "down" if delta < -0.2 else "flat",
        "source": source,
    })


def _run_readings(topic: str, role: str):
    consumer = _consumer(topic)
    logger.info(f"consuming {topic}")
    for msg in consumer:
        try:
            d = msg.value
            nid = d.get("meterId")
            energy = float(d.get("energy", 0))
            if nid is None:
                continue
            STATE.readings[nid] = {"energy": energy, "role": role}
            bus.publish_threadsafe({
                "type": "reading", "ts": now_ms(), "nodeId": nid, "role": role, "energy": energy,
            })
        except Exception as e:
            logger.error(f"{topic} parse error: {e}")


def _run_market_state():
    consumer = _consumer("market-state")
    logger.info("consuming market-state")
    for msg in consumer:
        try:
            d = msg.value
            supply = float(d.get("supply", 0))
            demand = float(d.get("demand", 0))
            STATE.spark_warm = True
            bus.publish_threadsafe({
                "type": "market", "ts": now_ms(), "supply": round(supply, 2),
                "demand": round(demand, 2), "source": "spark",
            })
            _emit_price(_price_from(supply, demand), "spark")
        except Exception as e:
            logger.error(f"market-state parse error: {e}")


def _run_trades():
    consumer = _consumer("trades")
    logger.info("consuming trades")
    for msg in consumer:
        try:
            t = msg.value
            tid = t.get("trade_id")
            if tid is None or tid in STATE.emitted_trades:
                continue
            STATE.emitted_trades.add(tid)
            trade = {
                "trade_id": tid, "seller": t["seller"], "buyer": t["buyer"],
                "units": float(t["units"]), "price": float(t["price"]),
            }
            emit_match_threadsafe(trade, spotlight=False)
        except Exception as e:
            logger.error(f"trades parse error: {e}")


def start():
    targets = [
        ("energy-production", lambda: _run_readings("energy-production", "producer")),
        ("energy-consumption", lambda: _run_readings("energy-consumption", "consumer")),
        ("market-state", _run_market_state),
        ("trades", _run_trades),
    ]
    for name, fn in targets:
        threading.Thread(target=fn, name=f"kafka-{name}", daemon=True).start()
