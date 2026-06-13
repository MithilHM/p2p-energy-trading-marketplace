FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY meter_simulator.py .

CMD ["python", "meter_simulator.py"]
