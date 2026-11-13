# ==============================================================================
# Production Dockerfile for React SPA Frontend
# ==============================================================================

# Stage 1: Build & Minify Frontend Assets
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build production bundle
RUN npm run build

# Stage 2: Serve via High-Performance Nginx Web Server
FROM nginx:alpine

# Copy compiled static distribution from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx reverse proxy and routing configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Production Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
