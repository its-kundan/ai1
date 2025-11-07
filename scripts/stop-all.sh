#!/bin/bash
# Stop all services for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛑 Stopping ChatGPT-like Demo Stack..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop model services if running
if [ -f /tmp/embed_service.pid ]; then
    EMBED_PID=$(cat /tmp/embed_service.pid)
    if ps -p $EMBED_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping embedding service (PID: $EMBED_PID)...${NC}"
        kill $EMBED_PID 2>/dev/null || true
        rm /tmp/embed_service.pid
    fi
fi

if [ -f /tmp/ocr_service.pid ]; then
    OCR_PID=$(cat /tmp/ocr_service.pid)
    if ps -p $OCR_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping OCR service (PID: $OCR_PID)...${NC}"
        kill $OCR_PID 2>/dev/null || true
        rm /tmp/ocr_service.pid
    fi
fi

if [ -f /tmp/llm_service.pid ]; then
    LLM_PID=$(cat /tmp/llm_service.pid)
    if ps -p $LLM_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping LLM service (PID: $LLM_PID)...${NC}"
        kill $LLM_PID 2>/dev/null || true
        rm /tmp/llm_service.pid
    fi
fi

# Stop Docker containers
echo -e "${YELLOW}Stopping Docker containers...${NC}"
cd "$PROJECT_ROOT"
docker-compose down

echo ""
echo -e "${GREEN}✓ All services stopped!${NC}"

