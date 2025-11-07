#!/bin/bash
# Start Redis using docker-compose
# Usage: ./scripts/start-redis.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "Starting Redis with docker-compose..."
docker compose -f docker-compose.redis.yml up -d

echo "Waiting for Redis to be ready..."
sleep 2

# Test connection
if docker compose -f docker-compose.redis.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is running and responding to PING"
    echo ""
    echo "Redis is available at:"
    echo "  Host: 127.0.0.1"
    echo "  Port: 6379"
    echo ""
    echo "To connect with redis-cli:"
    echo "  redis-cli -h 127.0.0.1 -p 6379"
    echo ""
    echo "To view logs:"
    echo "  docker compose -f docker-compose.redis.yml logs -f redis"
    echo ""
    echo "To stop Redis:"
    echo "  docker compose -f docker-compose.redis.yml down"
else
    echo "✗ Redis failed to start or is not responding"
    echo "Check logs with: docker compose -f docker-compose.redis.yml logs redis"
    exit 1
fi

