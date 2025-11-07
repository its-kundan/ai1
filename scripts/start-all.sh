#!/bin/bash
# Start all services for local development
# This script starts infrastructure (Postgres, Redis) and optionally model services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting ChatGPT-like Demo Stack..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a service is healthy
check_health() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $service_name to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

# Step 1: Start infrastructure (Postgres + Redis)
echo -e "${YELLOW}Step 1: Starting infrastructure (Postgres + Redis)...${NC}"
cd "$PROJECT_ROOT"
docker-compose up -d postgres redis

# Wait for Postgres
echo ""
check_health "http://localhost:5432" "PostgreSQL" || {
    echo "PostgreSQL health check failed. Check logs: docker-compose logs postgres"
    exit 1
}

# Wait for Redis
echo ""
check_health "http://localhost:6379" "Redis" || {
    # Redis doesn't have HTTP, so use redis-cli if available
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h 127.0.0.1 -p 6379 ping > /dev/null 2>&1; then
            echo -e "Redis ${GREEN}✓${NC}"
        else
            echo -e "Redis ${RED}✗${NC}"
            echo "Redis health check failed. Check logs: docker-compose logs redis"
            exit 1
        fi
    else
        echo -e "Redis ${YELLOW}⚠${NC} (redis-cli not found, assuming healthy)"
    fi
}

echo ""
echo -e "${GREEN}✓ Infrastructure is ready!${NC}"
echo ""

# Step 2: Start model services (optional)
if [ "$1" == "--with-models" ]; then
    echo -e "${YELLOW}Step 2: Starting model services...${NC}"
    cd "$PROJECT_ROOT/models"
    
    # Start embedding service
    echo "Starting embedding service on port 8100..."
    python -m services.embedding_service &
    EMBED_PID=$!
    sleep 3
    check_health "http://localhost:8100/health" "Embedding Service" || echo "Embedding service may not be ready yet"
    
    # Start OCR service
    echo "Starting OCR service on port 8200..."
    python -m services.ocr_service &
    OCR_PID=$!
    sleep 3
    check_health "http://localhost:8200/health" "OCR Service" || echo "OCR service may not be ready yet"
    
    # Start LLM service
    echo "Starting LLM service on port 5005..."
    python -m services.llm_service &
    LLM_PID=$!
    sleep 3
    check_health "http://localhost:5005/health" "LLM Service" || echo "LLM service may not be ready yet"
    
    echo "$EMBED_PID" > /tmp/embed_service.pid
    echo "$OCR_PID" > /tmp/ocr_service.pid
    echo "$LLM_PID" > /tmp/llm_service.pid
    
    echo ""
    echo -e "${GREEN}✓ Model services started (PIDs: $EMBED_PID, $OCR_PID, $LLM_PID)${NC}"
    echo ""
fi

# Step 3: Start backends (instructions)
echo -e "${YELLOW}Step 3: Start backends manually${NC}"
echo ""
echo "To start the Node backend (backend2):"
echo "  cd backend2"
echo "  npm install  # if not done"
echo "  npm run prisma:generate"
echo "  npm run prisma:push"
echo "  npm run dev"
echo ""
echo "To start the Python backend (backend):"
echo "  cd backend"
echo "  pip install -r requirements.txt  # if not done"
echo "  python -m app.main"
echo ""
echo "To start the frontend:"
echo "  cd frontend"
echo "  npm install  # if not done"
echo "  npm run dev"
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Stack Status:${NC}"
echo ""
echo "  ✓ PostgreSQL:  http://localhost:5432"
echo "  ✓ Redis:        http://localhost:6379"
if [ "$1" == "--with-models" ]; then
    echo "  ✓ Embedding:    http://localhost:8100"
    echo "  ✓ OCR:          http://localhost:8200"
    echo "  ✓ LLM:          http://localhost:5005"
fi
echo ""
echo "  Backend (Python):  http://localhost:8000"
echo "  Backend2 (Node):   http://localhost:8001"
echo "  Frontend:          http://localhost:3000"
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"

