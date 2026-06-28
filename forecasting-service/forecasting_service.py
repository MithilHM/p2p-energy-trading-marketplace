"""Forecasting service exposing demand (ARIMA, Phase 10) and price (ML, Phase 11)."""
import os
import time
import logging
import threading

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

from influx_data import InfluxReader, synthetic_demand_series
from demand_forecast import DemandForecaster
from price_forecast import PriceForecaster

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Forecasting Service", version="1.0.0")

INFLUX_HOST = os.getenv("INFLUXDB_HOST", "influxdb")
INFLUX_PORT = int(os.getenv("INFLUXDB_PORT", "8086"))
BASE_PRICE = 10.0  # must match the pricing engine

reader = InfluxReader(INFLUX_HOST, INFLUX_PORT)

# ---- Lightweight result cache ----
# Training ARIMA/XGBoost is the expensive part, so we memoize each endpoint's
# result for a short TTL. This keeps the service cheap even if the dashboard
# polls often: models are (re)trained at most once per TTL, not per request.
_CACHE_TTL = float(os.getenv("FORECAST_CACHE_TTL", "60"))
_cache: dict = {}
_cache_lock = threading.Lock()


def _cached(key: str, compute):
    """Return a memoized value for `key`, recomputing only after the TTL lapses.
    Computation runs under the lock so concurrent requests never double-train."""
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None and (time.monotonic() - hit[0]) < _CACHE_TTL:
            return hit[1]
        value = compute()
        _cache[key] = (time.monotonic(), value)
        return value


def _load_demand_series():
    """Hourly demand from market_state.demand, falling back to synthetic data."""
    series = reader.query_series("market_state", "demand", hours=72)
    if len(series) < 10:
        logger.info("Insufficient InfluxDB demand history; using synthetic series")
        series = synthetic_demand_series()
    return series


def _load_market_df():
    """Build a supply/demand/price training frame from market_state.

    Price isn't stored historically, so we derive a label using the same
    formula the pricing engine uses; the model then learns that relationship
    plus the hour-of-day effect. Falls back to synthetic data when sparse.
    """
    supply = reader.query_series("market_state", "supply", hours=72)
    demand = reader.query_series("market_state", "demand", hours=72)
    df = pd.DataFrame({"supply": supply, "demand": demand}).dropna()

    if len(df) < 10:
        logger.info("Insufficient InfluxDB market history; using synthetic series")
        s = synthetic_demand_series()
        df = pd.DataFrame({
            "supply": (s * 1.2).values,
            "demand": s.values,
        }, index=s.index)

    df["price"] = df.apply(
        lambda r: max(BASE_PRICE * 0.5, BASE_PRICE * (r["demand"] / r["supply"]))
        if r["supply"] > 0 else BASE_PRICE * 2,
        axis=1,
    )
    return df


@app.get("/health")
def health():
    return {"status": "ok"}


def _compute_forecast_demand(steps: int):
    series = _load_demand_series()
    forecaster = DemandForecaster()
    forecaster.train_model(series)
    forecasts = forecaster.forecast(steps=steps)
    return {
        "model": "ARIMA",
        "training_points": len(series),
        "next_hour_demand": forecasts[0]["demand"],
        "forecast": forecasts,
    }


@app.get("/forecast-demand")
def forecast_demand(steps: int = 1):
    """GET /forecast-demand: next-hour(s) demand via ARIMA. Result is cached
    for FORECAST_CACHE_TTL seconds to avoid retraining on every request."""
    try:
        return _cached(f"demand:{steps}", lambda: _compute_forecast_demand(steps))
    except Exception as e:
        logger.error(f"forecast_demand failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _compute_forecast_price(model: str, supply, demand):
    df = _load_market_df()
    forecaster = PriceForecaster(model_type=model)
    forecaster.train_model(df)

    if supply is None:
        supply = float(df["supply"].iloc[-1])
    if demand is None:
        # Use ARIMA next-hour demand forecast as the input demand
        demand_forecaster = DemandForecaster()
        demand_forecaster.train_model(df["demand"])
        demand = demand_forecaster.forecast(steps=1)[0]["demand"]

    price = forecaster.predict_price(supply, demand)
    return {
        "model": model,
        "training_rows": len(df),
        "input": {"supply": round(supply, 2), "demand": round(demand, 2)},
        "predicted_price": price,
    }


@app.get("/forecast-price")
def forecast_price(model: str = "xgboost", supply: float = None, demand: float = None):
    """GET /forecast-price: predict price for given (or forecasted) conditions.

    If supply/demand are omitted, uses the latest market values and the
    forecasted next-hour demand. Result is cached for FORECAST_CACHE_TTL
    seconds to avoid retraining the model on every request.
    """
    try:
        key = f"price:{model}:{supply}:{demand}"
        return _cached(key, lambda: _compute_forecast_price(model, supply, demand))
    except Exception as e:
        logger.error(f"forecast_price failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
