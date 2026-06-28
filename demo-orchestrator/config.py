"""Configuration + constants for the demo-orchestrator."""
import os

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
MQTT_HOST = os.getenv("MQTT_HOST", "mqtt")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

MATCHING_URL = os.getenv("MATCHING_URL", "http://matching-engine:8001")
PRICING_URL = os.getenv("PRICING_URL", "http://pricing-engine:8002")
BLOCKCHAIN_URL = os.getenv("BLOCKCHAIN_URL", "http://blockchain-service:8003")
FORECAST_URL = os.getenv("FORECAST_URL", "http://forecasting-service:8004")

ORCH_PORT = int(os.getenv("ORCH_PORT", "8010"))
AUTO_TRADE = os.getenv("AUTO_TRADE", "true").lower() == "true"
AUTO_SETTLE = os.getenv("AUTO_SETTLE", "true").lower() == "true"

# Pricing/market
BASE_PRICE = 10.0
PRICE_MIN = 5.0
PRICE_MAX = 20.0

# ---- Central-grid baseline (the thing P2P is compared against) ----
# These tariffs sit deliberately just OUTSIDE the P2P clearing band
# [PRICE_MIN, PRICE_MAX], so a peer trade always beats the grid by construction:
#   * a consumer buying P2P (<= PRICE_MAX) pays less than grid retail, and
#   * a producer selling P2P (>= PRICE_MIN) earns more than the feed-in tariff.
# GRID_LOSS_FACTOR models transmission/distribution losses a local P2P transfer
# avoids (energy-exchanged advantage). All in ₹/kWh-equivalent units.
GRID_RETAIL_TARIFF = float(os.getenv("GRID_RETAIL_TARIFF", "22.0"))   # consumer pays the grid
GRID_FEEDIN_TARIFF = float(os.getenv("GRID_FEEDIN_TARIFF", "3.0"))    # producer sells to the grid
GRID_LOSS_FACTOR = float(os.getenv("GRID_LOSS_FACTOR", "0.07"))       # line losses P2P avoids

# wei per energy unit when escrowing on-chain. Tiny so account #0's balance
# never runs dry across a long demo: amount = units * PRICE_PER_UNIT_WEI.
PRICE_PER_UNIT_WEI = 10 ** 12  # 1e12 wei = 0.000001 ETH/unit

# Hardhat deterministic accounts (public test addresses — local dev only).
# Index 0 is the service/buyer; peers map onto 1..19.
HARDHAT_ADDRESSES = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
    "0x71bE63f3384f5fb98995898A86B02Fb2426c5788",
    "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a",
    "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec",
    "0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097",
    "0xcd3B766CCDd6AE721141F452C550Ca635964ce71",
    "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
    "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
]


def now_ms() -> int:
    import time
    return int(time.time() * 1000)


def clamp_price(p: float) -> float:
    return max(PRICE_MIN, min(PRICE_MAX, p))
