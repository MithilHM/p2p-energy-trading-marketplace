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

# Hardhat's 20 deterministic private keys (public test keys — local dev only).
# Index 0 is the service/buyer; peers map onto 1..19. Used by /trade/settle-demo
# to sign confirmTrade AS the seller (the contract requires msg.sender==seller),
# enabling a full Created->Confirmed->Paid lifecycle for the narrated demo trade.
DEMO_KEYS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
    "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
    "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
    "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
    "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
    "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
    "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
    "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
    "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
    "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
    "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
]


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

    def _send_as(self, account, fn, value_wei=0):
        """Build, sign (with the given account), and send a transaction."""
        tx = fn.build_transaction({
            "from": account.address,
            "nonce": self.w3.eth.get_transaction_count(account.address),
            "value": value_wei,
            "gas": 500000,
            "gasPrice": self.w3.eth.gas_price,
        })
        signed = account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return receipt

    def _send(self, fn, value_wei=0):
        """Build, sign (with the service account #0), and send a transaction."""
        return self._send_as(self.account, fn, value_wei)

    def settle_demo(self, seller_index: int, units: int, price_per_unit_wei: int):
        """Full lifecycle for the narrated trade: create (buyer=acct0) ->
        confirm (signed AS the seller) -> release. Returns all tx hashes."""
        seller_index = max(1, min(19, int(seller_index)))
        seller_account = self.w3.eth.account.from_key(DEMO_KEYS[seller_index])
        trade_id, create_receipt = self.create_trade(
            seller_account.address, units, price_per_unit_wei
        )
        if trade_id is None:
            raise RuntimeError("createTrade did not emit a trade id")
        self._send_as(seller_account, self.contract.functions.confirmTrade(trade_id))
        pay_receipt = self.release_payment(trade_id)
        return {
            "trade_id": trade_id,
            "seller": seller_account.address,
            "tx_hash": create_receipt["transactionHash"].hex(),
            "settle_tx_hash": pay_receipt["transactionHash"].hex(),
            "block": pay_receipt["blockNumber"],
            "status": "Paid",
        }

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


class SettleDemoRequest(BaseModel):
    """Full-lifecycle settlement for the narrated demo trade. The seller is a
    Hardhat account index (1..19) so we can sign confirmTrade as that seller."""
    seller_index: int
    units: int
    price_per_unit_wei: int


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


@app.post("/trade/settle-demo")
def settle_trade_demo(req: SettleDemoRequest):
    """POST /trade/settle-demo: create + confirm (as seller) + release, so the
    narrated trade settles end-to-end on-chain with real funds moving."""
    if client.contract is None:
        raise HTTPException(status_code=503, detail="Contract not loaded yet")
    try:
        return client.settle_demo(req.seller_index, req.units, req.price_per_unit_wei)
    except Exception as e:
        logger.error(f"settle_trade_demo failed: {e}")
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
