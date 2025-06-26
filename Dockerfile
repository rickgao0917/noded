# Multi-stage Dockerfile for Node.js TypeScript application with hot-reloading
FROM node:18-alpine AS base

# Install system dependencies including Python3
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    bash \
    git

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

# Create development start script with better error handling
RUN cat > /app/dev-start.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting Noded development environment..."
echo "📁 Working directory: $(pwd)"
echo "📦 Node version: $(node --version)"
echo "🐍 Python version: $(python3 --version)"

# Check if required files exist
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi

if [ ! -f "scripts/fix-imports.js" ]; then
    echo "❌ scripts/fix-imports.js not found"
    exit 1
fi

echo "🔧 Building initial TypeScript..."
npm run build:all || {
    echo "❌ Initial build failed"
    exit 1
}

echo "🎯 Starting file watchers and servers..."
exec concurrently --kill-others --prefix-colors "cyan,magenta,yellow" \
  --names "SERVER,WATCH" \
  "nodemon --watch server-src --ext ts --exec 'npm run build:server && node server.js'" \
  "nodemon --watch src --ext ts --exec 'npm run build'"
EOF

# Make script executable
RUN chmod +x /app/dev-start.sh

# Development command with hot-reloading
CMD ["/app/dev-start.sh"]

# Production build stage
FROM base AS builder

# Build the application
RUN npm run build:all

# Production runtime stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    curl \
    dumb-init

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
    adduser -S nodeuser -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port 8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Production command using dumb-init for proper signal handling
CMD ["dumb-init", "node", "server.js"]

# Testing stage
FROM base AS testing

# Install additional testing dependencies
RUN npm install -g jest-cli

# Copy test files
COPY tests/ ./tests/
COPY jest.config.js ./

# Run tests
CMD ["npm", "test"]