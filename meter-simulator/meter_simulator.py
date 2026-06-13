import json
import time
import random
from datetime import datetime
import paho.mqtt.client as mqtt
import os
from math import sin, pi

class MeterSimulator:
    def __init__(self, mqtt_host="mqtt", mqtt_port=1883):
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.client = mqtt.Client(client_id="meter-simulator")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
        else:
            print(f"Failed to connect, return code {rc}")

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print(f"Unexpected disconnection: {rc}")

    def connect(self):
        try:
            self.client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            print(f"Connection error: {e}")
            raise

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def generate_solar_output(self, meter_id, hour_of_day):
        """
        Generate realistic solar production based on time of day.
        Peak at noon, zero at night.
        """
        # Solar production peaks at hour 12 (noon)
        if hour_of_day < 6 or hour_of_day > 18:
            base_output = 0
        else:
            # Bell curve from 6am to 6pm
            normalized_hour = (hour_of_day - 6) / 12
            base_output = 25 * sin(normalized_hour * pi)

        # Add some randomness
        noise = random.gauss(0, base_output * 0.1) if base_output > 0 else 0
        output = max(0, base_output + noise)

        return round(output, 2)

    def generate_consumption(self, meter_id, hour_of_day):
        """
        Generate realistic consumption pattern.
        Higher in morning and evening, lower midday and night.
        """
        if 0 <= hour_of_day < 6:
            base_consumption = 1.5
        elif 6 <= hour_of_day < 9:
            base_consumption = 5.0
        elif 9 <= hour_of_day < 12:
            base_consumption = 3.5
        elif 12 <= hour_of_day < 17:
            base_consumption = 2.5
        elif 17 <= hour_of_day < 21:
            base_consumption = 6.5
        else:
            base_consumption = 2.0

        # Add randomness
        noise = random.gauss(0, base_consumption * 0.15)
        consumption = max(0, base_consumption + noise)

        return round(consumption, 2)

    def publish_production(self, meter_id, energy):
        """Publish producer data to MQTT"""
        message = {
            "meterId": meter_id,
            "role": "producer",
            "energy": energy,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        payload = json.dumps(message)
        self.client.publish("energy/production", payload, qos=1)
        print(f"[PROD] {meter_id}: {energy} kWh")

    def publish_consumption(self, meter_id, energy):
        """Publish consumer data to MQTT"""
        message = {
            "meterId": meter_id,
            "role": "consumer",
            "energy": energy,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        payload = json.dumps(message)
        self.client.publish("energy/consumption", payload, qos=1)
        print(f"[CONS] {meter_id}: {energy} kWh")

    def run(self, interval=10):
        """
        Run the simulator.
        interval: seconds between each reading
        """
        self.connect()

        # Producer IDs (solar)
        producers = [f"P{i:03d}" for i in range(1, 6)]
        # Consumer IDs
        consumers = [f"C{i:03d}" for i in range(1, 11)]

        try:
            iteration = 0
            while True:
                # Simulate time progression (10 seconds = 1 hour in simulation)
                simulated_hour = (iteration // 6) % 24

                # Generate and publish production data
                for producer_id in producers:
                    energy = self.generate_solar_output(producer_id, simulated_hour)
                    self.publish_production(producer_id, energy)

                # Generate and publish consumption data
                for consumer_id in consumers:
                    energy = self.generate_consumption(consumer_id, simulated_hour)
                    self.publish_consumption(consumer_id, energy)

                time.sleep(interval)
                iteration += 1

        except KeyboardInterrupt:
            print("\nShutting down meter simulator...")
            self.disconnect()


if __name__ == "__main__":
    mqtt_host = os.getenv("MQTT_HOST", "mqtt")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))

    simulator = MeterSimulator(mqtt_host=mqtt_host, mqtt_port=mqtt_port)
    simulator.run(interval=10)
