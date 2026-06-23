import json
import time
import random
from datetime import datetime
import paho.mqtt.client as mqtt
import os
from math import sin, pi

# ---- Virtual P2P network generation ----
# The simulator now models a large peer-to-peer network (~180 nodes) instead of
# a handful of meters. Nodes are generated deterministically from SEED so every
# run produces an identical roster — essential for a scripted, repeatable demo.
# The roster is published as a RETAINED MQTT message on `energy/roster` so the
# demo-orchestrator (and any late subscriber) can enumerate the network and lay
# it out. Per-reading messages keep the original shape so the existing
# MQTT->Kafka->Spark pipeline is untouched.

PRODUCER_KINDS = ["solar", "solar", "solar", "wind", "battery"]
CONSUMER_KINDS = ["home", "home", "commercial", "industrial"]

# Bengaluru localities: (name, lng, lat). Peers are scattered around these.
LOCALITIES = [
    ("Koramangala", 77.6309, 12.9352), ("Indiranagar", 77.6408, 12.9719),
    ("Whitefield", 77.7500, 12.9698), ("HSR Layout", 77.6446, 12.9116),
    ("Jayanagar", 77.5833, 12.9250), ("Electronic City", 77.6770, 12.8452),
    ("Malleshwaram", 77.5650, 13.0035), ("Hebbal", 77.5970, 13.0358),
    ("JP Nagar", 77.5854, 12.9063), ("Marathahalli", 77.6974, 12.9569),
    ("BTM Layout", 77.6101, 12.9166), ("Yelahanka", 77.5963, 13.1007),
    ("Banashankari", 77.5560, 12.9255), ("Rajajinagar", 77.5560, 12.9916),
    ("Bellandur", 77.6762, 12.9259),
]
# bbox used to derive the 0-100 fallback coords
BBOX = (77.48, 77.78, 12.83, 13.14)  # minLng, maxLng, minLat, maxLat
HUB = ("MG Road", 77.6090, 12.9759)


def _producer_name(kind, area, n):
    if kind == "wind":
        return f"{area} Wind {n}"
    if kind == "battery":
        return f"{area} Battery Hub {n}"
    return f"{area} Rooftop Solar {n}"


def _consumer_name(kind, area, n):
    if kind == "industrial":
        return f"{area} Factory {n}"
    if kind == "commercial":
        return f"{area} Mall {n}"
    return f"{area} Home {n}"


def _to_xy(lng, lat):
    min_lng, max_lng, min_lat, max_lat = BBOX
    x = (lng - min_lng) / (max_lng - min_lng) * 100
    y = (1 - (lat - min_lat) / (max_lat - min_lat)) * 100  # north up
    return round(max(0, min(100, x)), 2), round(max(0, min(100, y)), 2)


def build_roster(seed, n_producers, n_consumers, n_prosumers):
    """Deterministically build ~180 peers scattered across Bengaluru localities,
    with real lat/long (for the geospatial map) and 0-100 fallback coords."""
    rng = random.Random(seed)
    nodes = []

    def make(i, side):
        area, blng, blat = LOCALITIES[rng.randrange(len(LOCALITIES))]
        lng = round(blng + (rng.random() - 0.5) * 0.045, 5)
        lat = round(blat + (rng.random() - 0.5) * 0.032, 5)
        x, y = _to_xy(lng, lat)
        if side == "producer":
            kind = rng.choice(PRODUCER_KINDS)
            name = _producer_name(kind, area, i)
            cap = round(8 + rng.random() * 42, 2)
            nid = f"P{i:03d}"
        elif side == "prosumer":
            kind = "prosumer"
            name = f"{area} Prosumer {i}"
            cap = round(4 + rng.random() * 14, 2)
            nid = f"X{i:03d}"
        else:
            kind = rng.choice(CONSUMER_KINDS)
            name = _consumer_name(kind, area, i)
            cap = round(3 + rng.random() * 20, 2)
            nid = f"C{i:03d}"
        return {
            "id": nid, "name": name, "type": side, "kind": kind,
            "x": x, "y": y, "lng": lng, "lat": lat, "area": area,
            "capacity_kwh": cap, "eth_account_index": (hash(nid) % 19) + 1,
        }

    for i in range(1, n_producers + 1):
        nodes.append(make(i, "producer"))
    for i in range(1, n_prosumers + 1):
        nodes.append(make(i, "prosumer"))
    for i in range(1, n_consumers + 1):
        nodes.append(make(i, "consumer"))
    return nodes


class MeterSimulator:
    def __init__(self, mqtt_host="mqtt", mqtt_port=1883, roster=None, publish_roster=True):
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.roster = roster or []
        self.publish_roster = publish_roster
        self.client = mqtt.Client(client_id="meter-simulator")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
            # (Re)publish the retained roster on every (re)connection.
            if self.publish_roster:
                self.publish_node_roster()
        else:
            print(f"Failed to connect, return code {rc}")

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print(f"Unexpected disconnection: {rc}")

    def connect(self):
        """Connect to MQTT broker, retrying until it is reachable."""
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                self.client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
                self.client.loop_start()
                return
            except Exception as e:
                print(f"MQTT connect attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def publish_node_roster(self):
        """Publish the full network roster as a RETAINED message so subscribers
        that connect later still receive it immediately."""
        payload = json.dumps({
            "version": 1,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "nodes": self.roster,
        })
        self.client.publish("energy/roster", payload, qos=1, retain=True)
        print(f"[ROSTER] published {len(self.roster)} nodes (retained)")

    def generate_solar_output(self, hour_of_day, capacity_kwh):
        """Realistic solar production based on time of day, scaled by capacity.
        Peak at noon, zero at night."""
        if hour_of_day < 6 or hour_of_day > 18:
            base_output = 0.0
        else:
            normalized_hour = (hour_of_day - 6) / 12
            base_output = capacity_kwh * sin(normalized_hour * pi)
        noise = random.gauss(0, base_output * 0.1) if base_output > 0 else 0
        return round(max(0.0, base_output + noise), 2)

    def generate_wind_output(self, capacity_kwh):
        """Wind is intermittent; independent of the solar day curve."""
        return round(max(0.0, capacity_kwh * (0.25 + random.random() * 0.6)), 2)

    def generate_battery_output(self, hour_of_day, capacity_kwh):
        """Batteries discharge around the evening peak."""
        discharge = max(0.0, sin((hour_of_day - 17) / 3))
        return round(capacity_kwh * discharge * (0.5 + random.random() * 0.5), 2)

    def generate_production(self, node, hour_of_day):
        cap = node["capacity_kwh"]
        kind = node.get("kind", "solar")
        if kind == "wind":
            return self.generate_wind_output(cap)
        if kind == "battery":
            return self.generate_battery_output(hour_of_day, cap)
        return self.generate_solar_output(hour_of_day, cap)

    def generate_consumption(self, hour_of_day, capacity_kwh):
        """Realistic consumption pattern scaled by capacity. Higher in the
        morning and evening, lower midday and overnight."""
        if 0 <= hour_of_day < 6:
            level = 0.25
        elif 6 <= hour_of_day < 9:
            level = 0.85
        elif 9 <= hour_of_day < 12:
            level = 0.55
        elif 12 <= hour_of_day < 17:
            level = 0.45
        elif 17 <= hour_of_day < 21:
            level = 1.0
        else:
            level = 0.35
        base = capacity_kwh * level
        noise = random.gauss(0, base * 0.15)
        return round(max(0.0, base + noise), 2)

    def publish_production(self, meter_id, energy):
        message = {
            "meterId": meter_id,
            "role": "producer",
            "energy": energy,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        self.client.publish("energy/production", json.dumps(message), qos=1)

    def publish_consumption(self, meter_id, energy):
        message = {
            "meterId": meter_id,
            "role": "consumer",
            "energy": energy,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        self.client.publish("energy/consumption", json.dumps(message), qos=1)

    def run(self, interval=10):
        """Run the simulator. interval: seconds between each round of readings."""
        self.connect()

        try:
            iteration = 0
            while True:
                # 10 seconds = ~1 simulated hour; full day every minute.
                simulated_hour = (iteration // 6) % 24

                produced = 0
                consumed = 0
                for node in self.roster:
                    ntype = node["type"]
                    if ntype in ("producer", "prosumer"):
                        energy = self.generate_production(node, simulated_hour)
                        self.publish_production(node["id"], energy)
                        produced += 1
                    if ntype in ("consumer", "prosumer"):
                        # prosumers draw a smaller load than dedicated consumers
                        cap = node["capacity_kwh"] * (0.5 if ntype == "prosumer" else 1.0)
                        energy = self.generate_consumption(simulated_hour, cap)
                        self.publish_consumption(node["id"], energy)
                        consumed += 1

                print(f"[TICK {iteration}] hour={simulated_hour} prod_msgs={produced} cons_msgs={consumed}")
                time.sleep(interval)
                iteration += 1

        except KeyboardInterrupt:
            print("\nShutting down meter simulator...")
            self.disconnect()


if __name__ == "__main__":
    mqtt_host = os.getenv("MQTT_HOST", "mqtt")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
    seed = int(os.getenv("SEED", "42"))
    n_producers = int(os.getenv("N_PRODUCERS", "60"))
    n_consumers = int(os.getenv("N_CONSUMERS", "90"))
    n_prosumers = int(os.getenv("N_PROSUMERS", "30"))
    publish_roster = os.getenv("PUBLISH_ROSTER", "true").lower() == "true"
    interval = int(os.getenv("INTERVAL", "10"))

    roster = build_roster(seed, n_producers, n_consumers, n_prosumers)
    print(f"Generated roster: {len(roster)} nodes "
          f"({n_producers} producers, {n_prosumers} prosumers, {n_consumers} consumers)")

    simulator = MeterSimulator(
        mqtt_host=mqtt_host, mqtt_port=mqtt_port,
        roster=roster, publish_roster=publish_roster,
    )
    simulator.run(interval=interval)
