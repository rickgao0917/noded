# Multi-stage Dockerfile for Node.js TypeScript application with hot-reloading
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Development stage with hot-reloading
FROM base AS development

# Install nodemon for hot-reloading
RUN npm install -g nodemon ts-node concurrently

# Expose ports for both client and server
EXPOSE 8000 3001

# Environment variables for development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

# Create development start script
RUN echo '#!/bin/sh' > /app/dev-start.sh && \
    echo 'echo "Starting development environment..."' >> /app/dev-start.sh && \
    echo 'echo "Building initial TypeScript..."' >> /app/dev-start.sh && \
    echo 'npm run build:all' >> /app/dev-start.sh && \
    echo 'echo "Starting file watchers and servers..."' >> /app/dev-start.sh && \
    echo 'concurrently --kill-others --prefix-colors "cyan,magenta,yellow" \' >> /app/dev-start.sh && \
    echo '  --names "CLIENT,SERVER,WATCH" \' >> /app/dev-start.sh && \
    echo '  "python3 -m http.server 8000" \' >> /app/dev-start.sh && \
    echo '  "nodemon --watch server-src --ext ts --exec \"npm run build:server && node server.js\"" \' >> /app/dev-start.sh && \
    echo '  "nodemon --watch src --ext ts --exec \"npm run build\""' >> /app/dev-start.sh && \
    chmod +x /app/dev-start.sh

# Development command with hot-reloading
CMD ["/app/dev-start.sh"]

# Production build stage
FROM base AS builder

# Build the application
RUN npm run build:all

# Production runtime stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/index.html ./
COPY --from=builder /app/standalone.html ./
COPY --from=builder /app/config ./config
COPY --from=builder /app/data ./data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port 8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Production command
CMD ["node", "server.js"]

# Testing stage
FROM base AS testing

# Install additional testing dependencies
RUN npm install -g jest-cli

# Copy test files
COPY tests/ ./tests/
COPY jest.config.js ./

# Run tests
CMD ["npm", "test"]