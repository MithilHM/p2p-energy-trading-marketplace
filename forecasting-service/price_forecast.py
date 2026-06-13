"""Phase 11: Price prediction using gradient-boosted / random-forest regressors."""
import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)


def _build_features(supply, demand, ts):
    """Features: supply, demand, supply/demand ratio, hour-of-day."""
    hour = ts.hour if hasattr(ts, "hour") else 0
    ratio = demand / supply if supply > 0 else 0.0
    return [supply, demand, ratio, hour]


class PriceForecaster:
    def __init__(self, model_type="xgboost"):
        self.model_type = model_type
        self.model = None

    def _new_model(self):
        if self.model_type == "random_forest":
            return RandomForestRegressor(n_estimators=100, random_state=42)
        return XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)

    def train_model(self, market_df):
        """train_model: fit on a dataframe with supply, demand, price, time columns.

        market_df index is the timestamp; columns: supply, demand, price.
        """
        if market_df is None or len(market_df) < 10:
            raise ValueError("Need at least 10 rows to train the price model")

        X, y = [], []
        for ts, row in market_df.iterrows():
            X.append(_build_features(row["supply"], row["demand"], ts))
            y.append(row["price"])

        self.model = self._new_model()
        self.model.fit(np.array(X), np.array(y))
        logger.info(f"{self.model_type} price model trained on {len(y)} rows")
        return self.model

    def predict_price(self, supply, demand, ts=None):
        """predict_price: forecast price for the given market conditions."""
        if self.model is None:
            raise RuntimeError("Model not trained")
        ts = ts or pd.Timestamp.utcnow()
        features = np.array([_build_features(supply, demand, ts)])
        pred = float(self.model.predict(features)[0])
        return round(max(0.0, pred), 4)
