#!/bin/bash
# Docker management scripts for Noded project
# This replaces all npm commands with Docker equivalents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
    echo -e "${GREEN}[NODED]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Development commands
dev() {
    print_status "Starting development environment with hot-reloading..."
    check_docker
    docker-compose --profile dev up --build
}

dev-build() {
    print_status "Building development environment..."
    check_docker
    docker-compose --profile dev build
}

dev-logs() {
    print_status "Showing development logs..."
    docker-compose --profile dev logs -f
}

dev-stop() {
    print_status "Stopping development environment..."
    docker-compose --profile dev down
}

dev-restart() {
    print_status "Restarting development environment..."
    docker-compose --profile dev restart
}

# Production commands
prod() {
    print_status "Starting production environment..."
    check_docker
    docker-compose --profile prod up -d --build
    print_info "Production server running at http://localhost:6001"
}

prod-build() {
    print_status "Building production environment..."
    check_docker
    docker-compose --profile prod build
}

prod-logs() {
    print_status "Showing production logs..."
    docker-compose --profile prod logs -f
}

prod-stop() {
    print_status "Stopping production environment..."
    docker-compose --profile prod down
}

prod-restart() {
    print_status "Restarting production environment..."
    docker-compose --profile prod restart
}

# Testing commands
test() {
    print_status "Running tests in Docker container..."
    check_docker
    docker-compose --profile test run --rm noded-test
}

test-coverage() {
    print_status "Running tests with coverage..."
    check_docker
    docker-compose --profile test run --rm noded-test npm run test:coverage
    print_info "Coverage report available in noded-test-coverage volume"
}

test-watch() {
    print_status "Running tests in watch mode..."
    check_docker
    docker-compose --profile test run --rm noded-test npm run test:watch
}

# Database commands
clear-db() {
    print_status "Clearing database..."
    check_docker
    docker-compose --profile db run --rm noded-db-manager
    print_warning "Database cleared. All users and workspaces have been removed."
}

# Utility commands
clean() {
    print_status "Cleaning up Docker resources..."
    check_docker
    
    print_info "Stopping all containers..."
    docker-compose down --remove-orphans
    
    print_info "Removing unused images..."
    docker image prune -f
    
    print_info "Removing unused volumes..."
    docker volume prune -f
    
    print_status "Cleanup complete!"
}

logs() {
    print_status "Showing logs for all services..."
    docker-compose logs -f
}

status() {
    print_status "Container status:"
    docker-compose ps
    
    print_info "Docker images:"
    docker images | grep noded
    
    print_info "Docker volumes:"
    docker volume ls | grep noded
}

build-all() {
    print_status "Building all Docker targets..."
    check_docker
    docker-compose build --parallel
}

# Shell access
shell() {
    local service=${1:-noded-dev}
    print_status "Opening shell in $service container..."
    docker-compose exec $service sh
}

# Help function
help() {
    cat << EOF
${GREEN}Noded Docker Management Script${NC}

${YELLOW}Development Commands:${NC}
  dev              Start development environment with hot-reloading
  dev-build        Build development environment
  dev-logs         Show development logs
  dev-stop         Stop development environment
  dev-restart      Restart development environment

${YELLOW}Production Commands:${NC}
  prod             Start production environment (http://localhost:6001)
  prod-build       Build production environment
  prod-logs        Show production logs
  prod-stop        Stop production environment
  prod-restart     Restart production environment

${YELLOW}Testing Commands:${NC}
  test             Run tests in Docker container
  test-coverage    Run tests with coverage report
  test-watch       Run tests in watch mode

${YELLOW}Database Commands:${NC}
  clear-db         Clear SQLite database (removes all data)

${YELLOW}Utility Commands:${NC}
  clean            Clean up Docker resources (images, volumes)
  logs             Show logs for all services
  status           Show container and resource status  
  build-all        Build all Docker targets
  shell [service]  Open shell in container (default: noded-dev)
  help             Show this help message

${YELLOW}Examples:${NC}
  ./docker-scripts.sh dev          # Start development with hot-reload
  ./docker-scripts.sh prod         # Start production server
  ./docker-scripts.sh test         # Run test suite
  ./docker-scripts.sh clear-db     # Reset database
  ./docker-scripts.sh shell        # Open development shell

${BLUE}Note:${NC} This script replaces all npm commands. Use Docker exclusively for development.
EOF
}

# Main script logic
case "${1:-help}" in
    dev|development)
        dev
        ;;
    dev-build)
        dev-build
        ;;
    dev-logs)
        dev-logs
        ;;
    dev-stop)
        dev-stop
        ;;
    dev-restart)
        dev-restart
        ;;
    prod|production)
        prod
        ;;
    prod-build)
        prod-build
        ;;
    prod-logs)
        prod-logs
        ;;
    prod-stop)
        prod-stop
        ;;
    prod-restart)
        prod-restart
        ;;
    test)
        test
        ;;
    test-coverage)
        test-coverage
        ;;
    test-watch)
        test-watch
        ;;
    clear-db)
        clear-db
        ;;
    clean)
        clean
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    build-all)
        build-all
        ;;
    shell)
        shell "${2}"
        ;;
    help|--help|-h)
        help
        ;;
    *)
        print_error "Unknown command: $1"
        help
        exit 1
        ;;
esac