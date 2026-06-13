FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY blockchain_service.py .

EXPOSE 8003

CMD ["uvicorn", "blockchain_service:app", "--host", "0.0.0.0", "--port", "8003"]
