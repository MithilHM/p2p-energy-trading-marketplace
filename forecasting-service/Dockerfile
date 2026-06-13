FROM python:3.11-slim

# Build tools needed by some scientific wheels
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY influx_data.py demand_forecast.py price_forecast.py forecasting_service.py ./

EXPOSE 8004

CMD ["uvicorn", "forecasting_service:app", "--host", "0.0.0.0", "--port", "8004"]
