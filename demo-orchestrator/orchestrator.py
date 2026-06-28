"""Demo Orchestrator — the single demo-facing API.

The dashboard talks ONLY to this service. It tails the live Kafka pipeline,
fans events out over a WebSocket, auto-generates orders so the market clears,
settles trades on-chain, and exposes a /demo control surface for the guided
walkthrough. CORS is open and there is no auth: this is explicitly the demo
surface, not a production API.
"""
import asyncio
import logging

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import kafka_consumers
import roster_store
import scenario
from auto_trader import auto_trader_task
from config import FORECAST_URL, MATCHING_URL, now_ms
from event_bus import bus
from market_aggregator import market_aggregator_task
from settlement import settlement_worker, gridcompare_event
from state import STATE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Demo Orchestrator", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- REST ----
@app.get("/health")
def health():
    return {
        "status": "ok",
        "roster": len(STATE.roster),
        "spark_warm": STATE.spark_warm,
        "ledger_count": STATE.ledger_count,
    }


@app.get("/roster")
def roster():
    if not STATE.roster:
        return {"status": "waiting", "nodes": []}
    return {"nodes": STATE.roster}


@app.get("/snapshot")
def snapshot():
    supply, demand = STATE.supply_demand()
    return {
        "roster": STATE.roster,
        "supply": supply,
        "demand": demand,
        "price": STATE.last_price,
        "spark_warm": STATE.spark_warm,
        "ledger": STATE.ledger,
        "ledger_total_eth": STATE.ledger_total_eth,
        "ledger_count": STATE.ledger_count,
        "grid_compare": gridcompare_event(),
    }


@app.get("/grid-compare")
def grid_compare():
    """P2P marketplace vs central-grid baseline (energy + money)."""
    return gridcompare_event()


@app.get("/market")
def market():
    supply, demand = STATE.supply_demand()
    return {"supply": supply, "demand": demand,
            "source": "spark" if STATE.spark_warm else "orchestrator"}


@app.get("/price")
def price():
    return {"price": STATE.last_price}


@app.get("/ledger")
def ledger():
    return {"entries": STATE.ledger, "total_eth": STATE.ledger_total_eth, "count": STATE.ledger_count}


@app.get("/matches")
async def matches():
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{MATCHING_URL}/matches", timeout=5.0)
            return r.json()
    except Exception as e:
        return {"error": str(e), "trades": []}


@app.get("/forecast")
async def forecast(steps: int = 3):
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{FORECAST_URL}/forecast-demand", params={"steps": steps}, timeout=8.0)
            return r.json()
    except Exception as e:
        return {"error": str(e)}


# ---- /demo control surface ----
class SpotlightReq(BaseModel):
    seller_id: str | None = None
    buyer_id: str | None = None
    units: float | None = None
    price: float | None = None


@app.post("/demo/run")
def demo_run():
    return scenario.run()


@app.post("/demo/reset")
def demo_reset():
    return scenario.reset()


@app.post("/demo/pause")
def demo_pause():
    return scenario.pause()


@app.post("/demo/resume")
def demo_resume():
    return scenario.resume()


@app.post("/demo/spotlight")
async def demo_spotlight(req: SpotlightReq | None = None):
    req = req or SpotlightReq()
    return await scenario.spotlight(req.seller_id, req.buyer_id, req.units, req.price)


@app.post("/demo/step")
async def demo_step():
    return await scenario.step()


# ---- WebSocket ----
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    q = bus.register()
    try:
        # initial burst: roster + current market/price + existing ledger
        if STATE.roster:
            await ws.send_json({"type": "roster", "ts": now_ms(), "nodes": STATE.roster})
        supply, demand = STATE.supply_demand()
        await ws.send_json({"type": "market", "ts": now_ms(), "supply": supply,
                            "demand": demand, "source": "spark" if STATE.spark_warm else "orchestrator"})
        await ws.send_json({"type": "price", "ts": now_ms(), "price": round(STATE.last_price, 2),
                            "deltaPct": 0.0, "trend": "flat",
                            "source": "spark" if STATE.spark_warm else "orchestrator"})
        for row in reversed(STATE.ledger):
            await ws.send_json(row)
        # current P2P-vs-grid totals so a reconnecting client sees them at once
        await ws.send_json(gridcompare_event())

        while True:
            event = await q.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"ws closed: {e}")
    finally:
        bus.unregister(q)


# ---- startup ----
@app.on_event("startup")
async def startup():
    loop = asyncio.get_running_loop()
    STATE.loop = loop
    bus.loop = loop
    roster_store.start()
    kafka_consumers.start()
    asyncio.create_task(market_aggregator_task())
    asyncio.create_task(auto_trader_task())
    asyncio.create_task(settlement_worker())
    logger.info("demo-orchestrator started")


if __name__ == "__main__":
    import uvicorn
    from config import ORCH_PORT
    uvicorn.run(app, host="0.0.0.0", port=ORCH_PORT)
