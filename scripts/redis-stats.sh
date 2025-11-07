#!/bin/bash
# Get Redis statistics and write to logs
# Usage: ./scripts/redis-stats.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
LOG_DIR="$PROJECT_ROOT/data/logs"
STATS_FILE="$LOG_DIR/redis_stats_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

echo "Collecting Redis statistics..."
echo "Redis: $REDIS_HOST:$REDIS_PORT"
echo "Log file: $STATS_FILE"
echo ""

# Check if Redis is available
if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo "Error: Redis is not available at $REDIS_HOST:$REDIS_PORT"
    exit 1
fi

{
    echo "=========================================="
    echo "Redis Statistics - $(date)"
    echo "=========================================="
    echo ""
    
    echo "--- Server Info ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO server | grep -E "^(redis_version|redis_mode|os|arch_bits|process_id)" || true
    echo ""
    
    echo "--- Memory Usage ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO memory | grep -E "^(used_memory_human|used_memory_peak_human|maxmemory_human|maxmemory_policy|mem_fragmentation_ratio)" || true
    echo ""
    
    echo "--- Key Statistics ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO keyspace || true
    echo ""
    
    echo "--- Cache Key Counts by Prefix ---"
    echo "Chat contexts: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'chat:*:context' 2>/dev/null | wc -l | tr -d ' ')"
    echo "LLM cache entries: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'llm:cache:*' 2>/dev/null | wc -l | tr -d ' ')"
    echo "Embedding cache entries: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'embed:cache:*' 2>/dev/null | wc -l | tr -d ' ')"
    echo "Job status entries: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'job:*' 2>/dev/null | wc -l | tr -d ' ')"
    echo "Lock entries: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'locks:*' 2>/dev/null | wc -l | tr -d ' ')"
    echo "Feature session entries: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern 'feature:session:*' 2>/dev/null | wc -l | tr -d ' ')"
    echo ""
    
    echo "--- Total Keys ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DBSIZE
    echo ""
    
    echo "--- Client Connections ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO clients | grep -E "^(connected_clients|blocked_clients)" || true
    echo ""
    
    echo "--- Persistence ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO persistence | grep -E "^(rdb_last_save_time|rdb_changes_since_last_save|aof_enabled|aof_last_rewrite_time_sec)" || true
    echo ""
    
    echo "--- Stats ---"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep -E "^(total_commands_processed|total_connections_received|keyspace_hits|keyspace_misses)" || true
    echo ""
    
    # Calculate hit rate if possible
    HITS=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep "keyspace_hits:" | cut -d: -f2 | tr -d '\r' || echo "0")
    MISSES=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep "keyspace_misses:" | cut -d: -f2 | tr -d '\r' || echo "0")
    
    if [ "$HITS" != "0" ] || [ "$MISSES" != "0" ]; then
        TOTAL=$((HITS + MISSES))
        if [ "$TOTAL" -gt 0 ]; then
            HIT_RATE=$(echo "scale=2; $HITS * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
            echo "Cache Hit Rate: ${HIT_RATE}% (${HITS} hits, ${MISSES} misses)"
        fi
    fi
    
    echo ""
    echo "=========================================="
    echo ""
} | tee -a "$STATS_FILE"

echo "Statistics saved to: $STATS_FILE"
echo ""
echo "To view recent stats:"
echo "  tail -n 50 $STATS_FILE"

