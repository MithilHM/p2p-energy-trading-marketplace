import os
import sys
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, sum as spark_sum, window,
    when, to_json, struct, to_timestamp, coalesce, lit
)
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType
)

# Schema for production/consumption messages.
# Both topics share this schema; the "role" field distinguishes
# producers (supply) from consumers (demand).
METER_SCHEMA = StructType([
    StructField("meterId", StringType()),
    StructField("role", StringType()),
    StructField("energy", DoubleType()),
    StructField("timestamp", StringType())
])

# Persistent checkpoint location (mounted volume, survives restarts)
CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR", "/checkpoint")
WINDOW_DURATION = "1 minute"
WATERMARK_DELAY = "2 minutes"


def create_spark_session(app_name="MarketStateProcessor"):
    """Initialize Spark session with Kafka integration"""
    return SparkSession \
        .builder \
        .appName(app_name) \
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0") \
        .config("spark.sql.streaming.checkpointLocation", f"{CHECKPOINT_DIR}/session") \
        .getOrCreate()


def readStream(spark, kafka_broker, topics):
    """readStream: Read both energy topics in a single stream.

    Subscribing to both topics at once lets us aggregate supply and demand
    in ONE stateful aggregation, avoiding a fragile stream-stream join of
    two separate aggregations (which is not supported in append mode).
    """
    return spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_broker) \
        .option("subscribe", topics) \
        .option("startingOffsets", "latest") \
        .load()


def parse_messages(df, schema):
    """Parse JSON messages from Kafka and derive event_time"""
    return df.select(
        from_json(col("value").cast("string"), schema).alias("data")
    ).select("data.*") \
     .withColumn("event_time", to_timestamp(col("timestamp")))


def aggregate_market_state(parsed_df):
    """groupBy + aggregate: Compute supply/demand/surplus per time window.

    A watermark is required so that append-mode output can finalize and emit
    each window once event time has advanced past it. supply and demand are
    derived from the same rows using conditional sums on the "role" field.
    """
    return parsed_df \
        .withWatermark("event_time", WATERMARK_DELAY) \
        .groupBy(window(col("event_time"), WINDOW_DURATION)) \
        .agg(
            spark_sum(when(col("role") == "producer", col("energy"))).alias("total_supply"),
            spark_sum(when(col("role") == "consumer", col("energy"))).alias("total_demand")
        ) \
        .select(
            col("window.start").alias("window_start"),
            # Null-safe: a window may contain only producers or only consumers
            coalesce(col("total_supply"), lit(0.0)).alias("total_supply"),
            coalesce(col("total_demand"), lit(0.0)).alias("total_demand")
        ) \
        .withColumn("surplus", col("total_supply") - col("total_demand"))


def writeStream(df, kafka_broker, output_topic, checkpoint_location):
    """writeStream: Write market state to Kafka in append mode.

    Append mode is valid here because this is a single windowed aggregation
    with a watermark - each window is emitted exactly once after the
    watermark passes its end.
    """
    output_df = df.select(
        to_json(struct(
            col("total_supply").alias("supply"),
            col("total_demand").alias("demand"),
            col("surplus"),
            col("window_start").alias("timestamp")
        )).alias("value")
    )

    return output_df \
        .writeStream \
        .format("kafka") \
        .outputMode("append") \
        .option("kafka.bootstrap.servers", kafka_broker) \
        .option("topic", output_topic) \
        .option("checkpointLocation", checkpoint_location) \
        .trigger(processingTime="10 seconds") \
        .start()


def main():
    """Main: Orchestrate the Spark Streaming pipeline"""

    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    topics = "energy-production,energy-consumption"
    output_topic = "market-state"

    print(f"[INFO] Connecting to Kafka: {kafka_broker}")

    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    try:
        # Single stream over both topics
        print(f"[INFO] Reading from {topics}")
        raw_stream = readStream(spark, kafka_broker, topics)

        # Parse JSON and derive event time
        parsed = parse_messages(raw_stream, METER_SCHEMA)

        # Single windowed aggregation (supply + demand + surplus)
        print("[INFO] Starting windowed aggregation...")
        market_state = aggregate_market_state(parsed)

        # Write to output topic
        print(f"[INFO] Writing to {output_topic} topic...")
        query = writeStream(
            market_state,
            kafka_broker,
            output_topic,
            f"{CHECKPOINT_DIR}/market-state"
        )

        print("[INFO] Streaming started. First window emits after watermark "
              f"({WATERMARK_DELAY}). Ctrl+C to stop.")
        query.awaitTermination()

    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
