"""Helper for loading historical series from InfluxDB.

Falls back to a synthetic series when InfluxDB has insufficient history, so the
forecasting endpoints remain usable in a fresh environment (e.g. for demos).
"""
import logging
from math import sin, pi

import numpy as np
import pandas as pd
from influxdb_client import InfluxDBClient

logger = logging.getLogger(__name__)


class InfluxReader:
    def __init__(self, host, port, org="energy_org", token="energy-token", bucket="energy_db"):
        self.url = f"http://{host}:{port}"
        self.org = org
        self.token = token
        self.bucket = bucket
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = InfluxDBClient(url=self.url, org=self.org, token=self.token)
        return self._client

    def query_series(self, measurement, field, hours=72):
        """Return a pandas Series indexed by time for the given measurement/field."""
        flux = f'''
        from(bucket: "{self.bucket}")
          |> range(start: -{hours}h)
          |> filter(fn: (r) => r._measurement == "{measurement}")
          |> filter(fn: (r) => r._field == "{field}")
          |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
          |> sort(columns: ["_time"])
        '''
        try:
            tables = self.client.query_api().query(flux, org=self.org)
            times, values = [], []
            for table in tables:
                for record in table.records:
                    times.append(record.get_time())
                    values.append(record.get_value())
            if times:
                return pd.Series(values, index=pd.DatetimeIndex(times))
        except Exception as e:
            logger.warning(f"InfluxDB query failed ({measurement}/{field}): {e}")
        return pd.Series(dtype=float)


def synthetic_demand_series(n=72):
    """Generate a plausible hourly demand series (daily seasonality + noise)."""
    rng = np.random.default_rng(42)
    hours = np.arange(n)
    daily = 50 + 30 * np.sin((hours % 24) / 24 * 2 * pi - pi / 2)
    noise = rng.normal(0, 4, n)
    values = np.clip(daily + noise, 0, None)
    idx = pd.date_range(end=pd.Timestamp.utcnow().floor("h"), periods=n, freq="h")
    return pd.Series(values, index=idx)
