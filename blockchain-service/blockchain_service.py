import os
import json
import time
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from web3 import Web3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Blockchain Integration Service", version="1.0.0")

# ---- Configuration ----
ETH_RPC = os.getenv("ETH_RPC", "http://hardhat:8545")
# Path to the deployment artifact produced by smart-contracts/scripts/deploy.js
DEPLOYMENT_PATH = os.getenv("DEPLOYMENT_PATH", "/deployments/EnergyTrade.json")
# Hardhat's first default account private key (deterministic local dev key).
# NOTE: local-dev only — never use a real key here.
DEFAULT_PRIVATE_KEY = os.getenv(
    "PRIVATE_KEY",
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
)

STATUS_NAMES = {0: "Created", 1: "Confirmed", 2: "Paid", 3: "Cancelled"}


class BlockchainClient:
    """Thin wrapper around web3.py for the EnergyTrade contract."""

    def __init__(self):
        self.w3: Optional[Web3] = None
        self.contract = None
        self.account = None

    def connect(self):
        """Connect to the Ethereum node and load the deployed contract, with retry."""
        delay = 2
        attempt = 0
        while True:
            attempt += 1
            try:
                self.w3 = Web3(Web3.HTTPProvider(ETH_RPC))
                if not self.w3.is_connected():
                    raise ConnectionError(f"Cannot reach Ethereum node at {ETH_RPC}")

                self.account = self.w3.eth.account.from_key(DEFAULT_PRIVATE_KEY)
                self._load_contract()
                logger.info(f"Connected to {ETH_RPC}, contract at {self.contract.address}")
                return
            except Exception as e:
                logger.warning(f"Blockchain connect attempt {attempt} failed: {e}")
                time.sleep(delay)
                delay = min(delay * 2, 30)

    def _load_contract(self):
        if not os.path.exists(DEPLOYMENT_PATH):
            raise FileNotFoundError(
                f"Deployment file {DEPLOYMENT_PATH} not found - deploy the contract first"
            )
        with open(DEPLOYMENT_PATH) as f:
            deployment = json.load(f)
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(deployment["address"]),
            abi=deployment["abi"],
        )

    def _send(self, fn, value_wei=0):
        """Build, sign, and send a transaction; return the receipt."""
        tx = fn.build_transaction({
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "value": value_wei,
            "gas": 500000,
            "gasPrice": self.w3.eth.gas_price,
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return receipt

    def create_trade(self, seller: str, units: int, price_per_unit_wei: int):
        """create_trade: escrow funds and create an on-chain trade."""
        value = units * price_per_unit_wei
        fn = self.contract.functions.createTrade(
            Web3.to_checksum_address(seller), units, price_per_unit_wei
        )
        receipt = self._send(fn, value_wei=value)
        # Decode the TradeCreated event to recover the trade id
        logs = self.contract.events.TradeCreated().process_receipt(receipt)
        trade_id = int(logs[0]["args"]["id"]) if logs else None
        return trade_id, receipt

    def confirm_trade(self, trade_id: int):
        return self._send(self.contract.functions.confirmTrade(trade_id))

    def release_payment(self, trade_id: int):
        return self._send(self.contract.functions.releasePayment(trade_id))

    def get_trade(self, trade_id: int):
        """get_trade: read on-chain trade state."""
        t = self.contract.functions.getTrade(trade_id).call()
        return {
            "id": int(t[0]),
            "buyer": t[1],
            "seller": t[2],
            "units": int(t[3]),
            "price_per_unit_wei": int(t[4]),
            "amount_wei": int(t[5]),
            "status": STATUS_NAMES.get(int(t[6]), "Unknown"),
            "created_at": int(t[7]),
        }


client = BlockchainClient()


# ---- API models ----
class SettleRequest(BaseModel):
    seller: str                 # Ethereum address
    units: int
    price_per_unit_wei: int
    # If true, auto-confirm and release in the same call (demo convenience).
    auto_settle: bool = False


# ---- Endpoints ----
@app.get("/health")
def health():
    connected = bool(client.w3 and client.w3.is_connected())
    return {"status": "ok", "eth_connected": connected}


@app.post("/trade/settle")
def settle_trade(req: SettleRequest):
    """POST /trade/settle: create (and optionally confirm+pay) an on-chain trade."""
    if client.contract is None:
        raise HTTPException(status_code=503, detail="Contract not loaded yet")
    try:
        trade_id, receipt = client.create_trade(req.seller, req.units, req.price_per_unit_wei)
        result = {
            "trade_id": trade_id,
            "tx_hash": receipt["transactionHash"].hex(),
            "block": receipt["blockNumber"],
            "status": "Created",
        }
        if req.auto_settle and trade_id is not None:
            client.confirm_trade(trade_id)
            pay_receipt = client.release_payment(trade_id)
            result["status"] = "Paid"
            result["settle_tx_hash"] = pay_receipt["transactionHash"].hex()
        return result
    except Exception as e:
        logger.error(f"settle_trade failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/trade/{trade_id}/confirm")
def confirm(trade_id: int):
    """Confirm delivery for a trade (seller action)."""
    try:
        receipt = client.confirm_trade(trade_id)
        return {"trade_id": trade_id, "tx_hash": receipt["transactionHash"].hex(), "status": "Confirmed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/trade/{trade_id}/release")
def release(trade_id: int):
    """Release escrowed payment to the seller."""
    try:
        receipt = client.release_payment(trade_id)
        return {"trade_id": trade_id, "tx_hash": receipt["transactionHash"].hex(), "status": "Paid"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/trade/{trade_id}")
def get_trade(trade_id: int):
    """GET /trade/{id}: read on-chain trade state."""
    if client.contract is None:
        raise HTTPException(status_code=503, detail="Contract not loaded yet")
    try:
        return client.get_trade(trade_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Trade not found or error: {e}")


@app.on_event("startup")
async def startup_event():
    import threading
    # Connect in the background so the API is responsive while the node/contract
    # come up (contract deployment may lag the node start).
    threading.Thread(target=client.connect, daemon=True).start()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
