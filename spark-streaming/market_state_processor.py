import os
import sys
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, sum as spark_sum, window,
    lit, concat_ws, to_json, struct, to_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType, TimestampType
)

# Schema for production/consumption messages
METER_SCHEMA = StructType([
    StructField("meterId", StringType()),
    StructField("role", StringType()),
    StructField("energy", DoubleType()),
    StructField("timestamp", StringType())
])


def create_spark_session(app_name="MarketStateProcessor"):
    """Initialize Spark session with Kafka integration"""
    return SparkSession \
        .builder \
        .appName(app_name) \
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0") \
        .config("spark.sql.streaming.checkpointLocation", "/tmp/spark-checkpoint") \
        .getOrCreate()


def readStream(spark, kafka_broker, topic):
    """readStream: Read from Kafka topic"""
    return spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_broker) \
        .option("subscribe", topic) \
        .option("startingOffsets", "latest") \
        .load()


def parse_messages(df, schema):
    """Parse JSON messages from Kafka"""
    return df.select(
        from_json(col("value").cast("string"), schema).alias("data"),
        col("timestamp")
    ).select("data.*", col("timestamp").alias("kafka_timestamp"))


def groupBy_and_aggregate(production_df, consumption_df):
    """groupBy and aggregate: Compute total supply and demand per time window"""

    # 1-minute tumbling window on both streams
    window_duration = "1 minute"

    # Aggregate production (supply)
    supply = production_df \
        .withColumn("event_time", to_timestamp(col("timestamp"))) \
        .groupBy(window(col("event_time"), window_duration)) \
        .agg(spark_sum(col("energy")).alias("total_supply"))

    # Aggregate consumption (demand)
    demand = consumption_df \
        .withColumn("event_time", to_timestamp(col("timestamp"))) \
        .groupBy(window(col("event_time"), window_duration)) \
        .agg(spark_sum(col("energy")).alias("total_demand"))

    # Join supply and demand on window
    market_state = supply.join(
        demand,
        on="window",
        how="outer"
    ).select(
        col("window.start").alias("window_start"),
        col("window.end").alias("window_end"),
        col("total_supply").cast("double"),
        col("total_demand").cast("double")
    )

    # Fill nulls with 0
    market_state = market_state.fillna(0)

    # Calculate surplus/deficit
    market_state = market_state.withColumn(
        "surplus",
        col("total_supply") - col("total_demand")
    )

    return market_state


def writeStream(df, kafka_broker, output_topic, checkpoint_location):
    """writeStream: Write market state to Kafka"""

    # Format output as JSON matching expected schema
    output_df = df.select(
        to_json(struct(
            col("total_supply").alias("supply"),
            col("total_demand").alias("demand"),
            col("surplus"),
            col("window_start").alias("timestamp")
        )).alias("value")
    )

    query = output_df \
        .writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_broker) \
        .option("topic", output_topic) \
        .option("checkpointLocation", checkpoint_location) \
        .option("startingOffsets", "earliest") \
        .trigger(processingTime="10 seconds") \
        .start()

    return query


def main():
    """Main: Orchestrate Spark Streaming pipeline"""

    # Configuration
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:29092")
    production_topic = "energy-production"
    consumption_topic = "energy-consumption"
    output_topic = "market-state"

    print(f"[INFO] Connecting to Kafka: {kafka_broker}")

    # Create Spark session
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    try:
        # Read Kafka streams
        print(f"[INFO] Reading from {production_topic} and {consumption_topic}")
        production_stream = readStream(spark, kafka_broker, production_topic)
        consumption_stream = readStream(spark, kafka_broker, consumption_topic)

        # Parse JSON
        production_df = parse_messages(production_stream, METER_SCHEMA)
        consumption_df = parse_messages(consumption_stream, METER_SCHEMA)

        # Aggregate
        print("[INFO] Starting aggregation...")
        market_state = groupBy_and_aggregate(production_df, consumption_df)

        # Write output
        print(f"[INFO] Writing to {output_topic} topic...")
        query = writeStream(
            market_state,
            kafka_broker,
            output_topic,
            "/tmp/spark-checkpoint-market-state"
        )

        # Await termination
        print("[INFO] Streaming started. Ctrl+C to stop.")
        query.awaitTermination()

    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
