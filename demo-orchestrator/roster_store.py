"""Subscribes to the retained `energy/roster` MQTT message, caches it, and maps
raw nodes to the frontend roster shape (adding a central Exchange hub)."""
import json
import logging
import threading
import time

import paho.mqtt.client as mqtt

from config import MQTT_HOST, MQTT_PORT, now_ms
from event_bus import bus
from state import STATE

logger = logging.getLogger(__name__)


def _to_frontend(node: dict) -> dict:
    side = "producer" if node.get("type") in ("producer", "prosumer") else "consumer"
    x = node.get("x", 0)
    y = node.get("y", 0)
    out = {
        "id": node["id"],
        "name": node.get("name", node["id"]),
        "kind": node.get("kind", "home"),
        "side": side,
        "x": x / 100.0 if x > 1 else x,
        "y": y / 100.0 if y > 1 else y,
        "capacityKw": node.get("capacity_kwh", 0),
    }
    if node.get("lng") is not None:
        out["lng"] = node["lng"]
        out["lat"] = node["lat"]
    if node.get("area"):
        out["area"] = node["area"]
    return out


def _ingest_roster(raw_nodes: list):
    STATE.roster_by_id = {n["id"]: n for n in raw_nodes}
    nodes = [_to_frontend(n) for n in raw_nodes]
    nodes.append({
        "id": "HUB", "name": "City Grid Hub", "kind": "battery",
        "side": "hub", "x": 0.43, "y": 0.5, "capacityKw": 0,
        "lng": 77.6090, "lat": 12.9759, "area": "MG Road",
    })
    STATE.roster = nodes
    logger.info(f"roster ingested: {len(nodes)} nodes")
    bus.publish_threadsafe({"type": "roster", "ts": now_ms(), "nodes": nodes})


def _on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("roster_store connected to MQTT")
        client.subscribe("energy/roster", qos=1)
    else:
        logger.warning(f"roster_store MQTT connect rc={rc}")


def _on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode("utf-8"))
        nodes = data.get("nodes", [])
        if nodes:
            _ingest_roster(nodes)
    except Exception as e:
        logger.error(f"roster parse failed: {e}")


def start():
    """Run the MQTT roster subscriber on a daemon thread with reconnect."""
    def _run():
        client = mqtt.Client(client_id="demo-orchestrator-roster")
        client.on_connect = _on_connect
        client.on_message = _on_message
        delay = 2
        while True:
            try:
                client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
                client.loop_forever()
            except Exception as e:
                logger.warning(f"roster MQTT connect failed: {e}; retrying")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    threading.Thread(target=_run, daemon=True).start()
