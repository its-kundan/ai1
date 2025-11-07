-- Initialize pgvector extension
-- This script runs automatically when the postgres container starts

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

