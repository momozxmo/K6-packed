# ═══════════════════════════════════════════════════
# Backend Dockerfile — Node.js 18 + K6
# ═══════════════════════════════════════════════════

FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json ./
RUN npm install --production=false

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ─── Production Stage ────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Install k6 binary
RUN apk add --no-cache curl ca-certificates \
    && curl -L https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz -o k6.tar.gz \
    && tar -xzf k6.tar.gz \
    && mv k6-v0.49.0-linux-amd64/k6 /usr/local/bin/k6 \
    && chmod +x /usr/local/bin/k6 \
    && rm -rf k6.tar.gz k6-v0.49.0-linux-amd64 \
    && k6 version

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy k6 scripts (they're plain JS, no compilation needed)
COPY src/k6-scripts ./dist/k6-scripts

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]
