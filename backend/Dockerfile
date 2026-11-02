# Production Dockerfile for Google Cloud Run Deployment
FROM python:3.12-slim

# Prevent Python from writing .pyc files & enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install build dependencies for ReportLab & OpenPyXL if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY . .

# Expose target port
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Execute FastAPI through Uvicorn
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2
