# Stage 1: Build frontend
FROM oven/bun:1.2.5 as frontend-builder
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY frontend/package.json frontend/bun.lock ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: Python backend
FROM python:3.11-slim
WORKDIR /app

# Install required system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY src/ ./src/

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Environment variables
ENV PYTHONPATH=/app
ENV PORT=8000

# Expose the port from environment variable
EXPOSE ${PORT}

# Run using main.py with API and multiple trips flags
CMD ["python", "src/main.py", "--api"]
