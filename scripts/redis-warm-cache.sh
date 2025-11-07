#!/bin/bash
# Warm Redis cache by reading parsed documents and populating caches
# Usage: ./scripts/redis-warm-cache.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PARSED_DIR="$PROJECT_ROOT/data/parsed"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "Warming Redis cache from parsed documents..."
echo "Reading from: $PARSED_DIR"

# Check if Redis is available
if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo "Error: Redis is not available at $REDIS_HOST:$REDIS_PORT"
    echo "Start Redis first with: ./scripts/start-redis.sh"
    exit 1
fi

# Count files
FILE_COUNT=$(find "$PARSED_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "No parsed JSON files found in $PARSED_DIR"
    echo "Run OCR and parsing first to generate data."
    exit 0
fi

echo "Found $FILE_COUNT parsed document(s)"
echo ""

# Process each parsed file
PROCESSED=0
SKIPPED=0

for file in "$PARSED_DIR"/*.json; do
    if [ ! -f "$file" ]; then
        continue
    fi

    filename=$(basename "$file")
    echo "Processing: $filename"

    # Extract document_id from filename or JSON
    # Try to read document_id from JSON
    if command -v jq > /dev/null 2>&1; then
        doc_id=$(jq -r '.document_id // .meta.document_id // empty' "$file" 2>/dev/null)
    else
        # Fallback: try to extract from filename
        doc_id=$(echo "$filename" | sed -E 's/^(document_|parsed_)([^.]+)\.json$/\2/')
    fi

    if [ -z "$doc_id" ] || [ "$doc_id" = "null" ]; then
        echo "  ⚠ Skipping: Could not extract document_id"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Here you would typically:
    # 1. Extract text snippets for embedding cache
    # 2. Pre-compute embeddings and cache them
    # 3. Cache common query patterns
    # For now, we'll just mark the document as processed

    # Example: Store document metadata in Redis
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SETEX "doc:meta:$doc_id" 2592000 "$(cat "$file")" > /dev/null 2>&1 || true

    PROCESSED=$((PROCESSED + 1))
    echo "  ✓ Cached metadata for document: $doc_id"
done

echo ""
echo "Cache warming complete:"
echo "  Processed: $PROCESSED"
echo "  Skipped: $SKIPPED"
echo ""
echo "Note: This is a basic warm-up. For full cache warming, you would:"
echo "  1. Extract text snippets from parsed documents"
echo "  2. Generate embeddings for common queries"
echo "  3. Pre-compute LLM responses for frequent prompts"
echo ""
echo "See docs/cache_examples.md for more details."

