#!/bin/bash
# Backup Redis RDB and AOF files
# Usage: ./scripts/backup-redis.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REDIS_DATA_DIR="$PROJECT_ROOT/data/redis_data"
REDIS_BACKUP_DIR="$PROJECT_ROOT/data/redis_backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Backing up Redis data..."
echo "Source: $REDIS_DATA_DIR"
echo "Destination: $REDIS_BACKUP_DIR"

# Create backup directory if it doesn't exist
mkdir -p "$REDIS_BACKUP_DIR"

# Check if Redis data directory exists
if [ ! -d "$REDIS_DATA_DIR" ]; then
    echo "Error: Redis data directory not found: $REDIS_DATA_DIR"
    exit 1
fi

# Backup RDB file if it exists
if [ -f "$REDIS_DATA_DIR/dump.rdb" ]; then
    echo "Backing up RDB file..."
    cp "$REDIS_DATA_DIR/dump.rdb" "$REDIS_BACKUP_DIR/dump_${DATE}.rdb"
    echo "✓ Saved: dump_${DATE}.rdb"
    
    # Keep only last 30 backups
    ls -t "$REDIS_BACKUP_DIR"/dump_*.rdb 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
else
    echo "⚠ No RDB file found (Redis may not have created a snapshot yet)"
fi

# Backup AOF file if it exists
if [ -f "$REDIS_DATA_DIR/appendonly.aof" ]; then
    echo "Backing up AOF file..."
    cp "$REDIS_DATA_DIR/appendonly.aof" "$REDIS_BACKUP_DIR/appendonly_${DATE}.aof"
    echo "✓ Saved: appendonly_${DATE}.aof"
    
    # Keep only last 30 backups
    ls -t "$REDIS_BACKUP_DIR"/appendonly_*.aof 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
else
    echo "ℹ AOF not enabled (appendonly=no in redis.conf)"
fi

# Also trigger a manual Redis save (if Redis is running)
if command -v redis-cli > /dev/null 2>&1; then
    if redis-cli -h 127.0.0.1 -p 6379 ping > /dev/null 2>&1; then
        echo "Triggering Redis BGSAVE..."
        redis-cli -h 127.0.0.1 -p 6379 BGSAVE > /dev/null 2>&1 || true
        echo "✓ Background save initiated"
    fi
fi

echo ""
echo "Backup complete!"
echo "Backups stored in: $REDIS_BACKUP_DIR"
echo ""
echo "To restore a backup, use:"
echo "  ./scripts/restore-redis.sh dump_${DATE}.rdb"

