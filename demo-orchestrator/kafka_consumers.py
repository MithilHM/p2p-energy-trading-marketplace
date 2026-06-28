"""Kafka consumers (daemon threads) that bridge the live pipeline into the demo
event stream. Single consumer group `demo-orchestrator`, latest offsets only."""
import json
import logging
import threading
import time

from kafka import KafkaConsumer

from config import KAFKA_BROKER, now_ms
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
            _ = msg.value
            # Note that Spark has warmed (surfaced in /health) but do NOT drive the
            # live chart from here: Spark emits one 1-minute window point at a time,
            # far too sparse and smooth for a compelling dashboard graph. The
            # high-frequency market_aggregator owns the supply/demand + price view.
            STATE.spark_warm = True
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
