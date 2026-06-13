# P2P Energy Trading Marketplace

A decentralized energy trading platform combining real-time data streaming, smart contracts, and dynamic pricing to enable peer-to-peer energy trading.

## Architecture Overview

- **Meter Simulator**: Generates production/consumption data
- **MQTT → Kafka Pipeline**: Ingests meter events into streaming
- **Spark Streaming**: Real-time market state computation
- **Storage Layer**: InfluxDB for historical data
- **Matching Engine**: Pairs sellers with buyers
- **Pricing Engine**: Dynamic price calculation
- **Smart Contracts**: Blockchain-based settlement (Ethereum)
- **Forecasting**: ARIMA demand, XGBoost price prediction
- **API Gateway**: Unified backend access
- **Dashboard**: React UI for producers/consumers

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.9+
- Java 11+ (for Spark)

### Start Infrastructure

```bash
cd energy-trading-platform
docker compose up
```

This starts:
- **Kafka** (message broker) on `localhost:9092`
- **Zookeeper** (Kafka coordinator) on `localhost:2181`
- **MQTT** (meter data) on `localhost:1883`
- **InfluxDB** (time-series DB) on `localhost:8086`
- **Hardhat** (Ethereum local node) on `localhost:8545`

### Check Services

```bash
# Kafka topics
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# InfluxDB
curl http://localhost:8086/api/v2/health

# Hardhat
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

## Phase Breakdown

| Phase | Service | Status |
|-------|---------|--------|
| 1 | Infrastructure | ✓ Complete |
| 2 | Meter Simulator | ✓ Complete |
| 3 | MQTT → Kafka | ✓ Complete |
| 4 | Spark Streaming | ✓ Complete |
| 5 | Storage Service | Pending |
| 6 | Matching Engine | Pending |
| 7 | Pricing Engine | Pending |
| 8 | Smart Contracts | Pending |
| 9 | Blockchain Integration | Pending |
| 10 | Demand Forecasting | Pending |
| 11 | Price Prediction | Pending |
| 12 | API Gateway | Pending |
| 13 | Dashboard | Pending |
| 14 | Monitoring & Deployment | Pending |

## Project Structure

```
energy-trading-platform/
├── meter-simulator/          # Phase 2
├── kafka-producer/           # Phase 3
├── spark-streaming/          # Phase 4
├── matching-engine/          # Phase 6
├── pricing-engine/           # Phase 7
├── smart-contracts/          # Phase 8
├── storage-service/          # Phase 5
├── forecasting-service/      # Phases 10-11
├── api-gateway/              # Phase 12
├── dashboard/                # Phase 13
├── docker/                   # Docker configs
├── k8s/                       # Kubernetes manifests
├── docker-compose.yml        # Local development
└── README.md
```

## Development Workflow

1. **Each phase** builds on the previous one
2. **Code-first**: Each phase delivers runnable code
3. **Independent testing**: Services tested standalone before integration
4. **Incremental**: Avoid waiting for all services before testing one

## Testing Phase 2 & 3: Data Pipeline

Once `docker compose up` is running:

### View MQTT Data (Phase 2)
```bash
# Subscribe to production data
docker run -it eclipse-mosquitto mosquitto_sub -h mqtt-broker -t energy/production

# In another terminal, subscribe to consumption data
docker run -it eclipse-mosquitto mosquitto_sub -h mqtt-broker -t energy/consumption
```

### View Kafka Topics (Phase 3)
```bash
# List Kafka topics
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Expected output:
# __consumer_offsets
# energy-consumption
# energy-production

# Read from energy-production topic
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic energy-production \
  --from-beginning

# Read from energy-consumption topic
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic energy-consumption \
  --from-beginning
```

## Testing Phase 4: Spark Streaming

Once all services are running, monitor the market state aggregations:

```bash
# Read market state from Kafka
# (Wait 60+ seconds for first aggregation window)
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic market-state \
  --from-beginning

# Example output:
# {"supply":125.43,"demand":87.32,"surplus":38.11,"timestamp":"2026-06-13T21:35:00Z"}
# {"supply":120.15,"demand":89.45,"surplus":30.70,"timestamp":"2026-06-13T21:36:00Z"}
```

**Spark Streaming Details:**
- Reads: `energy-production`, `energy-consumption` topics
- Aggregation: 1-minute tumbling windows
- Output: `market-state` topic
- Update frequency: Every 10 seconds

### Complete Data Flow
```
Meter Simulator → MQTT (energy/production, energy/consumption)
                    ↓
            MQTT-Kafka Bridge
                    ↓
            Kafka (energy-production, energy-consumption)
                    ↓
            Spark Streaming (aggregate per minute)
                    ↓
                Kafka (market-state)
```

## Next Steps

→ Phase 5: Storage Service (Persist data to InfluxDB)
