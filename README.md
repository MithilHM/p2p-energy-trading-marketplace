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
| 1 | Infrastructure | ✓ In Progress |
| 2 | Meter Simulator | Pending |
| 3 | MQTT → Kafka | Pending |
| 4 | Spark Streaming | Pending |
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

## Next Steps

→ Phase 2: Meter Simulator (MQTT producer for energy data)
