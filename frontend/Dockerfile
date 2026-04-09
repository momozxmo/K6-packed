# ═══════════════════════════════════════════════════
# Frontend Dockerfile — Vite Build + NGINX Serve
# ═══════════════════════════════════════════════════

FROM node:18-alpine AS builder

WORKDIR /app

# Build arguments for Vite env variables
ARG VITE_API_URL=http://localhost:3001
ARG VITE_WS_URL=ws://localhost:3001
ARG VITE_GRAFANA_URL=http://localhost:3000

# Expose as env vars during build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL

# Install dependencies first (cached layer)
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# ─── Production Stage (NGINX) ────────────────────
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom NGINX config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
