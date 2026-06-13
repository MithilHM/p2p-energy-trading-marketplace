"""Forecasting service exposing demand (ARIMA, Phase 10) and price (ML, Phase 11)."""
import os
import logging

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


@app.get("/forecast-demand")
def forecast_demand(steps: int = 1):
    """GET /forecast-demand: next-hour(s) demand via ARIMA."""
    try:
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
    except Exception as e:
        logger.error(f"forecast_demand failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forecast-price")
def forecast_price(model: str = "xgboost", supply: float = None, demand: float = None):
    """GET /forecast-price: predict price for given (or forecasted) conditions.

    If supply/demand are omitted, uses the latest market values and the
    forecasted next-hour demand.
    """
    try:
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
    except Exception as e:
        logger.error(f"forecast_price failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
