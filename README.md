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
docker compose up
```

This starts:
- **Kafka** (message broker) on `localhost:9092`
- **Zookeeper** (Kafka coordinator) on `localhost:2181`
- **MQTT** (meter data) on `localhost:1883`
- **InfluxDB** (time-series DB) on `localhost:8086`
- **Hardhat** (Ethereum local node) on `localhost:8545`

InfluxDB is provisioned automatically on first start (org `energy_org`, bucket
`energy_db`, admin token `energy-token`) — the storage service uses these
credentials directly. Services that depend on Kafka/InfluxDB wait for those
to report **healthy** before starting, and each service also retries its own
connection with backoff, so the stack comes up cleanly without crash-loops.

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
| 5 | Storage Service | ✓ Complete |
| 6 | Matching Engine | ✓ Complete |
| 7 | Pricing Engine | ✓ Complete |
| 8 | Smart Contracts | ✓ Complete |
| 9 | Blockchain Integration | ✓ Complete |
| 10 | Demand Forecasting | ✓ Complete |
| 11 | Price Prediction | ✓ Complete |
| 12 | API Gateway | ✓ Complete |
| 13 | Dashboard | Pending |
| 14 | Monitoring & Deployment | Pending |

## Project Structure

```
p2p-energy-trading-marketplace/
├── meter-simulator/          # Phase 2
├── kafka-producer/           # Phase 3
├── spark-streaming/          # Phase 4
├── matching-engine/          # Phase 6
├── pricing-engine/           # Phase 7
├── smart-contracts/          # Phase 8
├── blockchain-service/       # Phase 9
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
# Read market state from Kafka.
# NOTE: the first record appears only after the 1-minute window closes AND the
# 2-minute watermark passes it, so expect ~2-3 minutes of warm-up before output.
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic market-state \
  --from-beginning

# Example output:
# {"supply":125.43,"demand":87.32,"surplus":38.11,"timestamp":"2026-06-13T21:35:00Z"}
# {"supply":120.15,"demand":89.45,"surplus":30.70,"timestamp":"2026-06-13T21:36:00Z"}
```

**Spark Streaming Details:**
- Reads BOTH `energy-production` and `energy-consumption` in a single stream
- One windowed aggregation (1-minute tumbling) with a 2-minute watermark,
  deriving supply/demand from the `role` field — no fragile stream-stream join
- Output: `market-state` topic, written in append mode (each window emitted once)
- Checkpoint persisted to a Docker volume, so restarts don't reprocess old data

## Testing Phase 5: Storage Service

The storage service persists all Kafka topics to InfluxDB:

```bash
# List InfluxDB buckets (after storage-service runs 60+ seconds)
curl http://localhost:8086/api/v2/buckets \
  -H "Authorization: Token energy-token"

# Query energy_production measurements (in InfluxDB UI)
# Organization: energy_org, Bucket: energy_db
# Measurements: energy_production, energy_consumption, market_state
```

**Storage Details:**
- Consumes: `energy-production`, `energy-consumption`, `market-state` topics
- Persists to InfluxDB with tags: `meter_id` (for production/consumption)
- Time-indexed for historical analysis

## Testing Phase 6: Matching Engine

Test the matching engine API (runs on `localhost:8001`):

```bash
# Health check
curl http://localhost:8001/health

# Create a sell order (producer P001 selling 50 units @ $8/unit)
curl -X POST http://localhost:8001/sell \
  -H "Content-Type: application/json" \
  -d '{
    "seller_id": "P001",
    "energy_units": 50,
    "price_per_unit": 8.0
  }'

# Create a buy order (consumer C001 buying 50 units, willing to pay max $9/unit)
curl -X POST http://localhost:8001/buy \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_id": "C001",
    "energy_units": 50,
    "max_price_per_unit": 9.0
  }'

# View all executed trades
curl http://localhost:8001/matches

# View pending orders
curl http://localhost:8001/orders

# Get specific trade
curl http://localhost:8001/trades/T000000
```

**Matching Engine Details:**
- Matches based on: buyer's max_price ≥ seller's asking_price
- Trade price: seller's asking price (favorable to seller)
- Publishes trades to `trades` Kafka topic

## Testing Phase 7: Pricing Engine

Test the pricing engine API (runs on `localhost:8002`):

```bash
# Health check
curl http://localhost:8002/health

# Get current market price (based on supply/demand)
curl http://localhost:8002/current-price
# Example response:
# {
#   "current_price": 11.54,
#   "supply": 120.5,
#   "demand": 89.3,
#   "price_trend": "rising",
#   "timestamp": "2026-06-13T21:45:00Z"
# }

# Get price history (last 50 values)
curl http://localhost:8002/price-history?limit=50

# Get price analytics
curl http://localhost:8002/analytics
# Example response:
# {
#   "min_price": 8.5,
#   "max_price": 14.2,
#   "avg_price": 10.8,
#   "current_price": 11.54,
#   "volatility_percent": 40.2,
#   "samples": 45
# }
```

**Pricing Formula:**
```
price = BASE_PRICE(10) * (demand / supply)
- High demand + low supply = high price
- Low demand + high supply = low price
```

### Complete Data Flow (Phases 1-7)
```
Meters (MQTT)
  ↓
MQTT-Kafka Bridge → energy-production, energy-consumption
  ↓
Spark Streaming → market-state (1-min aggregation)
  ↓
├─→ Storage Service → InfluxDB (historical data)
├─→ Pricing Engine (calculates dynamic prices)
└─→ Matching Engine (awaits buy/sell orders)
```

## Testing Phase 8: Smart Contracts

The `smart-contracts` project (Hardhat) is auto-compiled, deployed, and the
address/ABI written to `smart-contracts/deployments/EnergyTrade.json` when the
`hardhat` container starts. To run the contract tests locally:

```bash
cd smart-contracts
npm install
npx hardhat compile
npx hardhat test
```

`EnergyTrade.sol` provides escrow-based settlement: `createTrade()` (buyer
escrows funds), `confirmTrade()` (seller confirms delivery), `releasePayment()`
(funds to seller), `cancelTrade()` (refund buyer), and `getTrade()`.

## Testing Phase 9: Blockchain Integration

The blockchain service (`localhost:8003`) bridges the backend to Ethereum via
web3.py. It reads the deployed contract address/ABI from the shared volume.

```bash
# Health (also reports Ethereum connectivity)
curl http://localhost:8003/health

# Settle a trade end-to-end (create + confirm + release) using a Hardhat account.
# price_per_unit_wei is wei per unit; value escrowed = units * price_per_unit_wei.
curl -X POST http://localhost:8003/trade/settle \
  -H "Content-Type: application/json" \
  -d '{
    "seller": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "units": 20,
    "price_per_unit_wei": 1000000000,
    "auto_settle": true
  }'

# Read a trade's on-chain state
curl http://localhost:8003/trade/0
```

## Testing Phases 10 & 11: Forecasting Service

The forecasting service (`localhost:8004`) trains on InfluxDB history, falling
back to a synthetic series when history is sparse (so it works on a fresh stack).

```bash
# Phase 10 - ARIMA demand forecast (next hour, or next N hours)
curl "http://localhost:8004/forecast-demand?steps=3"
# { "model": "ARIMA", "next_hour_demand": 1320.0, "forecast": [...] }

# Phase 11 - price prediction (xgboost default; or model=random_forest)
curl "http://localhost:8004/forecast-price?model=xgboost"
# Optionally pass explicit conditions:
curl "http://localhost:8004/forecast-price?supply=120&demand=95"
```

## Testing Phase 12: API Gateway

The gateway (`localhost:8000`) is the single authenticated entry point. Obtain a
JWT, then call backend services through `/orders`, `/pricing`, `/forecast`,
`/trades` prefixes.

```bash
# 1. Log in (demo users: producer/producer123, consumer/consumer123, admin/admin123)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=admin&password=admin123" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Call services through the gateway (Authorization header required)
curl http://localhost:8000/pricing/current-price -H "Authorization: Bearer $TOKEN"
curl "http://localhost:8000/forecast/forecast-demand?steps=2" -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/orders/matches -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/trades/trade/0 -H "Authorization: Bearer $TOKEN"

# Without a valid token -> 401
curl http://localhost:8000/pricing/current-price
```

**Gateway routing:**
| Prefix | Backend | Port |
|--------|---------|------|
| `/orders/*`   | matching-engine     | 8001 |
| `/pricing/*`  | pricing-engine      | 8002 |
| `/trades/*`   | blockchain-service  | 8003 |
| `/forecast/*` | forecasting-service | 8004 |

## Next Steps

→ Phase 13: React Dashboard (Producer / Consumer / Market views)
