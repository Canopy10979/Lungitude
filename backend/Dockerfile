FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd -m appuser
COPY backend /app/backend
USER appuser
EXPOSE 8002
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8002", "--ws-max-size", "180000", "--ws-max-queue", "1", "--limit-concurrency", "8"]
