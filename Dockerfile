# Multi-stage build for Node.js TypeScript application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM python:3.11-alpine AS runtime

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./
COPY --from=builder /app/standalone.html ./
COPY --from=builder /app/config ./config

# Expose port 8000
EXPOSE 8000

# Start the HTTP server
CMD ["python3", "-m", "http.server", "8000"]