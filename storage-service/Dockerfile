FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY storage_writer.py .

CMD ["python", "storage_writer.py"]
