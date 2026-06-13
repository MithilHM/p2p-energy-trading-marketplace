import json
import os
from datetime import datetime
from kafka import KafkaConsumer
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StorageWriter:
    def __init__(self, kafka_broker="kafka:29092", influx_host="influxdb", influx_port=8086):
        self.kafka_broker = kafka_broker
        self.influx_host = influx_host
        self.influx_port = influx_port
        self.influx_client = None
        self.write_api = None
        self.init_influxdb()

    def init_influxdb(self):
        """Initialize InfluxDB connection, retrying until it is reachable."""
        url = f"http://{self.influx_host}:{self.influx_port}"
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                self.influx_client = InfluxDBClient(
                    url=url,
                    org="energy_org",
                    token="energy-token"
                )
                # ping() verifies the server is reachable and the token is valid
                self.influx_client.ping()
                self.write_api = self.influx_client.write_api(write_type=SYNCHRONOUS)

                bucket = self.influx_client.buckets_api().find_bucket_by_name("energy_db")
                if bucket:
                    logger.info(f"Connected to InfluxDB bucket: {bucket.name}")
                else:
                    logger.warning("Bucket energy_db not found; it should be auto-created by InfluxDB init")
                return
            except Exception as e:
                logger.warning(f"InfluxDB init attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def save_production(self, meter_id, energy, timestamp_str):
        """save_production: Store production data to InfluxDB"""
        try:
            point = (
                Point("energy_production")
                .tag("meter_id", meter_id)
                .field("energy", float(energy))
                .time(self.parse_timestamp(timestamp_str))
            )
            self.write_api.write(bucket="energy_db", record=point)
            logger.info(f"[PROD] {meter_id}: {energy} kWh → InfluxDB")
        except Exception as e:
            logger.error(f"Error saving production: {e}")

    def save_consumption(self, meter_id, energy, timestamp_str):
        """save_consumption: Store consumption data to InfluxDB"""
        try:
            point = (
                Point("energy_consumption")
                .tag("meter_id", meter_id)
                .field("energy", float(energy))
                .time(self.parse_timestamp(timestamp_str))
            )
            self.write_api.write(bucket="energy_db", record=point)
            logger.info(f"[CONS] {meter_id}: {energy} kWh → InfluxDB")
        except Exception as e:
            logger.error(f"Error saving consumption: {e}")

    def save_market_state(self, supply, demand, surplus, timestamp_str):
        """save_market_state: Store market state to InfluxDB"""
        try:
            point = (
                Point("market_state")
                .field("supply", float(supply))
                .field("demand", float(demand))
                .field("surplus", float(surplus))
                .time(self.parse_timestamp(timestamp_str))
            )
            self.write_api.write(bucket="energy_db", record=point)
            logger.info(f"[MARKET] Supply: {supply}, Demand: {demand}, Surplus: {surplus}")
        except Exception as e:
            logger.error(f"Error saving market state: {e}")

    def parse_timestamp(self, timestamp_str):
        """Parse ISO format timestamp to nanoseconds since epoch"""
        try:
            if timestamp_str.endswith("Z"):
                timestamp_str = timestamp_str[:-1] + "+00:00"
            dt = datetime.fromisoformat(timestamp_str)
            return int(dt.timestamp() * 1e9)
        except Exception:
            return int(datetime.utcnow().timestamp() * 1e9)

    def _create_consumer(self, topic, group_id):
        """Create a KafkaConsumer, retrying until the broker is reachable."""
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                consumer = KafkaConsumer(
                    topic,
                    bootstrap_servers=[self.kafka_broker],
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    auto_offset_reset="earliest",
                    group_id=group_id
                )
                logger.info(f"Consuming from {topic} topic...")
                return consumer
            except Exception as e:
                logger.warning(f"Kafka consumer init for {topic} attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def consume_production(self):
        """Consume from energy-production topic"""
        consumer = self._create_consumer("energy-production", "storage-production")
        for message in consumer:
            try:
                data = message.value
                self.save_production(data["meterId"], data["energy"], data["timestamp"])
            except Exception as e:
                logger.error(f"Error processing message: {e}")

    def consume_consumption(self):
        """Consume from energy-consumption topic"""
        consumer = self._create_consumer("energy-consumption", "storage-consumption")
        for message in consumer:
            try:
                data = message.value
                self.save_consumption(data["meterId"], data["energy"], data["timestamp"])
            except Exception as e:
                logger.error(f"Error processing message: {e}")

    def consume_market_state(self):
        """Consume from market-state topic"""
        consumer = self._create_consumer("market-state", "storage-market-state")
        for message in consumer:
            try:
                data = message.value
                self.save_market_state(data["supply"], data["demand"], data["surplus"], data["timestamp"])
            except Exception as e:
                logger.error(f"Error processing message: {e}")

    def run_all(self):
        """Run all consumers in separate threads"""
        import threading

        threads = [
            threading.Thread(target=self.consume_production, daemon=True),
            threading.Thread(target=self.consume_consumption, daemon=True),
            threading.Thread(target=self.consume_market_state, daemon=True),
        ]

        for thread in threads:
            thread.start()

        logger.info("All storage writers running. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.influx_client.close()


if __name__ == "__main__":
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    influx_host = os.getenv("INFLUXDB_HOST", "influxdb")
    influx_port = int(os.getenv("INFLUXDB_PORT", "8086"))

    writer = StorageWriter(kafka_broker=kafka_broker, influx_host=influx_host, influx_port=influx_port)
    writer.run_all()
