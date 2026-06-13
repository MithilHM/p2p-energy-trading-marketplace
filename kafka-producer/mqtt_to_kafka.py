import json
import time
import paho.mqtt.client as mqtt
from kafka import KafkaProducer
from kafka.errors import KafkaError
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MQTTToKafkaBridge:
    def __init__(self, mqtt_host="mqtt", mqtt_port=1883, kafka_broker="kafka:29092"):
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.kafka_broker = kafka_broker

        # MQTT client
        self.mqtt_client = mqtt.Client(client_id="mqtt-kafka-bridge")
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_message = self.on_mqtt_message
        self.mqtt_client.on_disconnect = self.on_mqtt_disconnect

        # Kafka producer
        self.kafka_producer = None
        self.init_kafka()

    def init_kafka(self):
        """Initialize Kafka producer, retrying until the broker is reachable."""
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                self.kafka_producer = KafkaProducer(
                    bootstrap_servers=[self.kafka_broker],
                    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                    acks='all',
                    retries=3
                )
                logger.info(f"Kafka producer initialized: {self.kafka_broker}")
                return
            except Exception as e:
                logger.warning(f"Kafka init attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected to MQTT broker at {self.mqtt_host}:{self.mqtt_port}")
            # Subscribe to both topics
            client.subscribe("energy/production", qos=1)
            client.subscribe("energy/consumption", qos=1)
            logger.info("Subscribed to energy/production and energy/consumption")
        else:
            logger.error(f"Failed to connect to MQTT, return code {rc}")

    def on_mqtt_message(self, client, userdata, msg):
        """mqtt_callback: Handle incoming MQTT messages"""
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            self.send_to_kafka(msg.topic, payload)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from MQTT: {e}")
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def send_to_kafka(self, mqtt_topic, payload):
        """send_to_kafka: Route MQTT messages to appropriate Kafka topic"""
        # Map MQTT topics to Kafka topics
        topic_mapping = {
            "energy/production": "energy-production",
            "energy/consumption": "energy-consumption"
        }

        kafka_topic = topic_mapping.get(mqtt_topic)
        if not kafka_topic:
            logger.warning(f"Unknown MQTT topic: {mqtt_topic}")
            return

        try:
            future = self.kafka_producer.send(kafka_topic, payload)
            record_metadata = future.get(timeout=10)
            logger.info(
                f"[{kafka_topic}] Partition: {record_metadata.partition}, "
                f"Offset: {record_metadata.offset}, MeterId: {payload.get('meterId')}"
            )
        except KafkaError as e:
            logger.error(f"Failed to send to Kafka: {e}")

    def on_mqtt_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning(f"Unexpected MQTT disconnection: {rc}")

    def connect(self):
        """Connect to MQTT broker, retrying until it is reachable."""
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                self.mqtt_client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
                self.mqtt_client.loop_start()
                return
            except Exception as e:
                logger.warning(f"MQTT connect attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def disconnect(self):
        """Disconnect from MQTT and Kafka"""
        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        if self.kafka_producer:
            self.kafka_producer.close()

    def run(self):
        """Run the bridge"""
        self.connect()
        try:
            logger.info("MQTT to Kafka bridge running...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down bridge...")
            self.disconnect()


if __name__ == "__main__":
    mqtt_host = os.getenv("MQTT_HOST", "mqtt")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")

    bridge = MQTTToKafkaBridge(mqtt_host=mqtt_host, mqtt_port=mqtt_port, kafka_broker=kafka_broker)
    bridge.run()
