# ==============================================================================
# RailMadad Passenger Frontend Dockerfile
# Multi-stage: Node.js build -> Nginx Alpine production serve
# ==============================================================================

# Stage 1: Build static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_API_URL=/api
ARG VITE_ML_URL=/ml
ARG VITE_ML_SERVICE_URL=/api/complaints

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ML_URL=$VITE_ML_URL
ENV VITE_ML_SERVICE_URL=$VITE_ML_SERVICE_URL

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
