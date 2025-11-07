#!/bin/bash
# Reset development environment
# This script clears Redis keys, drops and recreates test DB, and deletes uploads

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔄 Resetting development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Confirm action
read -p "This will clear Redis, reset the database, and delete uploads. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Clear Redis keys
echo -e "${YELLOW}Step 1: Clearing Redis keys...${NC}"
if command -v redis-cli &> /dev/null; then
    redis-cli -h 127.0.0.1 -p 6379 FLUSHDB
    echo -e "${GREEN}✓ Redis cleared${NC}"
else
    # Use Docker exec if redis-cli not available
    docker-compose exec -T redis redis-cli FLUSHDB 2>/dev/null || {
        echo -e "${RED}✗ Failed to clear Redis. Is Redis running?${NC}"
    }
fi

# Step 2: Reset PostgreSQL database
echo ""
echo -e "${YELLOW}Step 2: Resetting PostgreSQL database...${NC}"
cd "$PROJECT_ROOT"
docker-compose exec -T postgres psql -U postgres -d chatdb <<EOF
-- Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Recreate pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
EOF
echo -e "${GREEN}✓ Database reset${NC}"

# Step 3: Reinitialize database schema (backend2)
echo ""
echo -e "${YELLOW}Step 3: Reinitializing database schema...${NC}"
if [ -d "$PROJECT_ROOT/backend2" ]; then
    cd "$PROJECT_ROOT/backend2"
    if [ -f "package.json" ]; then
        npm run prisma:push 2>/dev/null || echo "Prisma push failed (may need manual run)"
        echo -e "${GREEN}✓ Schema reinitialized${NC}"
    fi
fi

# Step 4: Delete uploads
echo ""
echo -e "${YELLOW}Step 4: Cleaning up uploads...${NC}"
if [ -d "$PROJECT_ROOT/data/uploads" ]; then
    find "$PROJECT_ROOT/data/uploads" -type f -delete
    echo -e "${GREEN}✓ Uploads deleted${NC}"
fi

# Step 5: Delete OCR results
echo ""
echo -e "${YELLOW}Step 5: Cleaning up OCR results...${NC}"
if [ -d "$PROJECT_ROOT/data/ocr_results" ]; then
    find "$PROJECT_ROOT/data/ocr_results" -type f -name "*.json" -delete
    echo -e "${GREEN}✓ OCR results deleted${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Development environment reset complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/start-all.sh"
echo "  2. Start your backend: cd backend2 && npm run dev"
echo "  3. Start your frontend: cd frontend && npm run dev"
echo -e "${GREEN}════════════════════════════════════════${NC}"

