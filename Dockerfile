# Stage 1: Build frontend
FROM oven/bun:1.2.5 AS frontend-base
WORKDIR /usr/src/app

FROM frontend-base AS frontend-install
RUN mkdir -p /temp/dev
COPY frontend/package.json frontend/bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY frontend/package.json frontend/bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM frontend-base AS frontend-prerelease
COPY --from=frontend-install /temp/dev/node_modules node_modules
COPY frontend/ .

ENV NODE_ENV=production
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
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy backend code
COPY src/ ./src

# Copy built frontend from frontend-builder stage
COPY --from=frontend-prerelease /usr/src/app/dist ./frontend/dist

# Environment variables
ENV PORT=8000

# Expose the port from environment variable
EXPOSE ${PORT}

# Run using main.py with API and multiple trips flags
CMD ["python", "src/main.py", "--api"]
