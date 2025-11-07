# Data Directory Structure

This directory contains all persistent data for the chatgpt-local-demo project. All data is organized by type and purpose to ensure clear separation of concerns and easy backup/recovery.

## Directory Structure

```
data/
├── uploads/                # Raw uploaded files (PDF, JPG, PNG) - immutable after upload
├── ocr_results/            # OCR JSON results (document_id.json)
├── parsed/                 # Normalized parsed outputs (bank/cdr/ipdr) as JSON
├── faiss_index/            # FAISS index files or serialized vector index
├── pgvector_backups/       # SQL/CSV exports or vector backups (if using pgvector)
├── sqlite/                 # SQLite DB files (if used by Python backend)
├── postgres_backups/       # PostgreSQL dump snapshots (if using Postgres)
├── redis_data/             # Redis persistent data directory (RDB/AOF files)
├── redis_backups/          # Redis backup snapshots (RDB/AOF copies)
└── logs/                   # Structured logs from services (rotated)
```

## Naming Conventions

### Uploaded Files
- Store original filenames with UUID prefix: `{uuid}_{original_filename}`
- Example: `550e8400-e29b-41d4-a716-446655440000_statement.pdf`

### OCR Results
- Format: `ocr_{document_id}.json`
- Example: `ocr_doc_12345.json`
- Each JSON contains:
  ```json
  {
    "document_id": "doc_12345",
    "pages": [...],
    "text": "...",
    "meta": {
      "uploader": "user",
      "original_filename": "statement.pdf",
      "sha256": "...",
      "detected_pages": 5,
      "languages": ["en"],
      "created_at": "2025-01-08T10:00:00Z"
    }
  }
  ```

### Parsed Documents
- Format: `document_{uuid}.json` or `parsed_{document_id}.json`
- Example: `document_550e8400-e29b-41d4-a716-446655440000.json`
- Each JSON contains normalized parsed data:
  ```json
  {
    "document_id": "doc_12345",
    "doc_type": "bank_statement",
    "parsed_data": {...},
    "meta": {
      "uploader": "user",
      "original_filename": "statement.pdf",
      "sha256": "...",
      "parser_version": "1.0",
      "created_at": "2025-01-08T10:00:00Z"
    }
  }
  ```

### FAISS Index Files
- Format: `faiss_{YYYY-MM-DD}.idx` or `faiss_index.idx`
- Example: `faiss_2025-01-08.idx`
- Use ISO8601 timestamps for dated backups

### Database Backups
- SQLite: `sqlite_backup_{YYYYMMDD}.db`
- Postgres: `postgres_backup_{YYYYMMDD}.sql` or `postgres_backup_{YYYYMMDD}.dump`
- Redis: `redis_backup_{YYYYMMDD}.rdb` or `redis_backup_{YYYYMMDD}.aof`

### Log Files
- Format: `{service}_{YYYY-MM-DD}.log`
- Example: `backend_2025-01-08.log`
- Rotate daily or when size exceeds 100MB

## Metadata Standards

All JSON files should include a `meta` object with:
- `uploader`: User identifier (for single-user demo, can be "user")
- `original_filename`: Original uploaded filename
- `sha256`: SHA256 checksum of the original file
- `created_at`: ISO8601 timestamp
- `updated_at`: ISO8601 timestamp (if applicable)
- Additional type-specific metadata

## Backup Strategy

### Daily Backups (Manual or Scheduled)
1. **Redis**: Copy `data/redis_data/dump.rdb` to `data/redis_backups/dump_YYYYMMDD.rdb`
2. **Postgres**: Run `pg_dump` to `data/postgres_backups/postgres_backup_YYYYMMDD.sql`
3. **SQLite**: Copy DB file to `data/sqlite/sqlite_backup_YYYYMMDD.db`
4. **Parsed Data**: Archive `data/parsed/` to timestamped tarball

### Recovery
- Restore Redis: Copy backup RDB file to `data/redis_data/dump.rdb` and restart Redis
- Restore Postgres: `psql < data/postgres_backups/postgres_backup_YYYYMMDD.sql`
- Restore SQLite: Replace DB file with backup
- Restore Parsed: Extract tarball to `data/parsed/`

## Security Notes

- **PII Handling**: Sensitive data (account numbers, phone numbers) should be masked before caching in Redis
- **File Permissions**: Ensure uploads and parsed data are readable only by the application user
- **Backup Encryption**: Consider encrypting backups containing PII before storage

## Size Management

- **Uploads**: Consider archiving old uploads (>90 days) to cold storage
- **OCR Results**: Can be regenerated, so older results can be archived
- **Parsed Data**: Keep as source of truth; archive only if disk space is limited
- **Logs**: Rotate and compress logs older than 30 days

## Git Ignore

All files in `data/` are ignored by git (see `.gitignore`). Only `.gitkeep` files are tracked to preserve directory structure.

