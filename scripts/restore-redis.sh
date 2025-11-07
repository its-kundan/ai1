#!/bin/bash
# Restore Redis from backup RDB file
# Usage: ./scripts/restore-redis.sh [backup_file]
# Example: ./scripts/restore-redis.sh dump_20250108_120000.rdb

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REDIS_DATA_DIR="$PROJECT_ROOT/data/redis_data"
REDIS_BACKUP_DIR="$PROJECT_ROOT/data/redis_backups"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$REDIS_BACKUP_DIR"/*.rdb 2>/dev/null | awk '{print "  " $9}' || echo "  (no backups found)"
    exit 1
fi

BACKUP_FILE="$1"

# If backup file doesn't have path, assume it's in backup directory
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="$REDIS_BACKUP_DIR/$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will replace the current Redis data with the backup!"
echo "Backup file: $BACKUP_FILE"
echo "Target: $REDIS_DATA_DIR/dump.rdb"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Stop Redis if running (to ensure clean restore)
if docker compose -f "$PROJECT_ROOT/docker-compose.redis.yml" ps redis 2>/dev/null | grep -q "Up"; then
    echo "Stopping Redis..."
    docker compose -f "$PROJECT_ROOT/docker-compose.redis.yml" stop redis
    sleep 2
fi

# Create data directory if it doesn't exist
mkdir -p "$REDIS_DATA_DIR"

# Backup current RDB file if it exists
if [ -f "$REDIS_DATA_DIR/dump.rdb" ]; then
    CURRENT_BACKUP="$REDIS_DATA_DIR/dump.rdb.$(date +%Y%m%d_%H%M%S).bak"
    echo "Backing up current RDB to: $CURRENT_BACKUP"
    cp "$REDIS_DATA_DIR/dump.rdb" "$CURRENT_BACKUP"
fi

# Restore backup
echo "Restoring from backup..."
cp "$BACKUP_FILE" "$REDIS_DATA_DIR/dump.rdb"
echo "✓ Restore complete"

# Restart Redis if it was running
if docker compose -f "$PROJECT_ROOT/docker-compose.redis.yml" ps redis 2>/dev/null | grep -q "redis"; then
    echo "Starting Redis..."
    docker compose -f "$PROJECT_ROOT/docker-compose.redis.yml" start redis
    sleep 2
    
    if docker compose -f "$PROJECT_ROOT/docker-compose.redis.yml" exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✓ Redis is running with restored data"
    else
        echo "⚠ Redis started but may not be responding yet"
    fi
fi

echo ""
echo "Restore complete!"
echo "Redis data has been restored from: $BACKUP_FILE"

