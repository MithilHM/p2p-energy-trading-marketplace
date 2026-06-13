"""Phase 10: Demand forecasting using ARIMA."""
import logging
import warnings

import numpy as np
from statsmodels.tsa.arima.model import ARIMA

logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore")  # statsmodels convergence chatter


class DemandForecaster:
    def __init__(self, order=(2, 1, 2)):
        self.order = order
        self.model_fit = None

    def train_model(self, series):
        """train_model: fit an ARIMA model on the historical demand series."""
        if series is None or len(series) < 10:
            raise ValueError("Need at least 10 data points to train ARIMA")
        model = ARIMA(series.astype(float).values, order=self.order)
        self.model_fit = model.fit()
        logger.info(f"ARIMA{self.order} trained on {len(series)} points")
        return self.model_fit

    def forecast(self, steps=1):
        """forecast: predict the next `steps` hourly demand values."""
        if self.model_fit is None:
            raise RuntimeError("Model not trained")
        result = self.model_fit.get_forecast(steps=steps)
        mean = result.predicted_mean
        conf = result.conf_int(alpha=0.05)
        forecasts = []
        for i in range(steps):
            forecasts.append({
                "step": i + 1,
                "demand": round(float(max(0.0, mean[i])), 2),
                "lower": round(float(max(0.0, conf[i][0])), 2),
                "upper": round(float(max(0.0, conf[i][1])), 2),
            })
        return forecasts
