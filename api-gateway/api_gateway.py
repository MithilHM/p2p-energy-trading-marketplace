"""Phase 12: API Gateway.

Single entry point that authenticates callers with JWT and proxies requests to
the backend services:
  /orders/*   -> matching-engine
  /pricing/*  -> pricing-engine
  /forecast/* -> forecasting-service
  /trades/*   -> blockchain-service
Plus /auth/login to obtain a token.
"""
import os
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import FastAPI, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
import asyncio
import json
import aiomqtt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="API Gateway", version="1.0.0")

# Enable CORS for the dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Auth config ----
# Local-dev secret. Override via env in any real deployment.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
TOKEN_TTL_MINUTES = int(os.getenv("TOKEN_TTL_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Demo users (username -> password). Replace with a real user store in production.
DEMO_USERS = {
    "producer": "producer123",
    "consumer": "consumer123",
    "admin": "admin123",
}

# ---- Service routing table ----
SERVICE_MAP = {
    "orders": os.getenv("MATCHING_URL", "http://matching-engine:8001"),
    "pricing": os.getenv("PRICING_URL", "http://pricing-engine:8002"),
    "forecast": os.getenv("FORECAST_URL", "http://forecasting-service:8004"),
    "trades": os.getenv("BLOCKCHAIN_URL", "http://blockchain-service:8003"),
}

# Map the gateway prefix to the backend path prefix. Most services expose their
# routes at the root, so we strip the gateway prefix before forwarding.
PREFIX_REWRITE = {
    "orders": "",      # /orders/sell  -> /sell
    "pricing": "",     # /pricing/current-price -> /current-price
    "forecast": "",    # /forecast/forecast-demand -> /forecast-demand
    "trades": "",      # /trades/trade/1 -> /trade/1
}


# ---- JWT helpers ----
def create_access_token(subject: str) -> str:
    """jwt issuance"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def jwt_validation(token: str = Depends(oauth2_scheme)) -> str:
    """auth_middleware / jwt_validation: verify the bearer token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=401, detail="Invalid token: no subject")
        return subject
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


# ---- Auth endpoint ----
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    """Exchange username/password for a JWT."""
    expected = DEMO_USERS.get(form.username)
    if expected is None or expected != form.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(form.username)
    return {"access_token": token, "token_type": "bearer", "expires_in_minutes": TOKEN_TTL_MINUTES}


@app.get("/health")
def health():
    return {"status": "ok", "services": list(SERVICE_MAP.keys())}


async def _proxy(service: str, path: str, request: Request):
    """service_routing: forward the request to the target backend service."""
    base_url = SERVICE_MAP.get(service)
    if base_url is None:
        raise HTTPException(status_code=404, detail=f"Unknown service '{service}'")

    target_url = f"{base_url}/{path}".rstrip("/")
    body = await request.body()
    # Forward original headers except host; gateway auth header is not needed downstream.
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "authorization")}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                params=dict(request.query_params),
                content=body if body else None,
                headers=headers,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Upstream {service} unreachable: {e}")

    # Pass through JSON when possible
    content_type = resp.headers.get("content-type", "")
    if "application/json" in content_type:
        return JSONResponse(status_code=resp.status_code, content=resp.json())
    return JSONResponse(status_code=resp.status_code, content={"raw": resp.text})


# ---- Routed endpoints (all require a valid JWT) ----
@app.get("/producer/dashboard")
async def get_producer_dashboard(subject: str = Depends(jwt_validation)):
    money_earned = 0.0
    energy_sold = 0.0
    energy_produced_today = 150.5  # In a full system, this would come from InfluxDB

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            base_url = SERVICE_MAP.get("orders")
            if base_url:
                resp = await client.get(f"{base_url}/matches")
                if resp.status_code == 200:
                    data = resp.json()
                    trades = data.get("trades", [])
                    # For demo purposes, we tally trades for the subject.
                    # The demo 'producer' user will act as a catch-all if no trades match their exact name.
                    for t in trades:
                        seller = t.get("seller")
                        if seller == subject or (subject == "producer" and str(seller).startswith("P")):
                            money_earned += (t.get("units", 0) * t.get("price", 0))
                            energy_sold += t.get("units", 0)
        except Exception as e:
            logger.error(f"Error fetching matches for dashboard: {e}")

    connection_steps = [
        "1. Install an MQTT client (e.g., Mosquitto or Paho MQTT).",
        "2. Connect to the broker at 'mqtt:1883' (or 'localhost:1883' if running outside Docker).",
        "3. To publish production data, send a JSON payload to topic 'energy/production'.",
        "   Example payload: {\"meterId\": \"P001\", \"role\": \"producer\", \"energy\": 12.5, \"timestamp\": \"2026-06-24T12:00:00Z\"}",
        "4. (Optional) Subscribe to 'energy/roster' (retained) to get the full list of P2P network nodes."
    ]

    return {
        "producer_id": subject,
        "energy_produced_today_kwh": energy_produced_today,
        "energy_sold_kwh": round(energy_sold, 2),
        "money_earned_dollars": round(money_earned, 2),
        "connection_steps": connection_steps
    }

@app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def gateway(service: str, path: str, request: Request, subject: str = Depends(jwt_validation)):
    if service not in SERVICE_MAP:
        raise HTTPException(status_code=404, detail=f"No route for /{service}")
    logger.info(f"[{subject}] {request.method} /{service}/{path}")
    return await _proxy(service, path, request)


# ---- Edge Device Control Endpoint ----
@app.post("/edge/control")
async def control_edge(request: Request, subject: str = Depends(jwt_validation)):
    """Publish an ON/OFF control command to the MQTT broker for the ESP32."""
    try:
        body = await request.json()
        status = body.get("status")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not status or status.lower() not in ("on", "off"):
        raise HTTPException(status_code=400, detail="Status must be 'on' or 'off'")

    mqtt_host = os.getenv("MQTT_HOST", "mqtt")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))

    try:
        async with aiomqtt.Client(hostname=mqtt_host, port=mqtt_port) as client:
            await client.publish("p2p/edge/control", payload=json.dumps({"status": status.lower()}))
        logger.info(f"[{subject}] Control command '{status}' sent to edge device.")
        return {"status": "success", "message": f"Control command '{status}' sent to edge device."}
    except Exception as e:
        logger.error(f"Failed to publish control command: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to connect to MQTT broker: {e}")


# ---- Edge Device WebSocket Bridge ----
@app.websocket("/ws/edge")
async def edge_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Edge WebSocket client connected")
    
    # Run the MQTT subscriber task
    async def listen_mqtt():
        try:
            # We connect to mosquitto on the docker network (or localhost if port mapped)
            mqtt_host = os.getenv("MQTT_HOST", "mqtt")
            mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
            logger.info(f"Connecting to MQTT at {mqtt_host}:{mqtt_port}")
            async with aiomqtt.Client(hostname=mqtt_host, port=mqtt_port) as client:
                await client.subscribe("p2p/edge/telemetry")
                async for message in client.messages:
                    payload = message.payload.decode()
                    logger.info(f"MQTT message received: {payload}")
                    try:
                        data = json.loads(payload)
                        # Push to the connected frontend WebSocket
                        await websocket.send_json(data)
                    except json.JSONDecodeError:
                        logger.error("Invalid JSON payload from MQTT")
        except aiomqtt.MqttError as e:
            logger.error(f"MQTT Error: {e}")
            await websocket.close()
        except Exception as e:
            logger.error(f"Unexpected error in MQTT listener: {e}")
            await websocket.close()

    mqtt_task = asyncio.create_task(listen_mqtt())

    try:
        while True:
            # Keep connection alive, wait for client disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Edge WebSocket client disconnected")
        mqtt_task.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
