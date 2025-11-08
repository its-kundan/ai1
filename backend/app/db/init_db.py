"""
Database initialization and session management.
"""
from sqlmodel import SQLModel, create_engine, Session
from pathlib import Path
import os

# Database file path
DB_DIR = Path(__file__).parent.parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "app.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def init_db():
    """Initialize database tables."""
    from app.models.db_models import Document, ChatMessage, Chat, VectorIndex
    
    SQLModel.metadata.create_all(engine)
    print(f"Database initialized at {DB_PATH}")


def get_session():
    """Get database session (dependency for FastAPI)."""
    with Session(engine) as session:
        yield session


def reset_db():
    """Drop and recreate all tables (for development)."""
    SQLModel.metadata.drop_all(engine)
    init_db()
    print("Database reset complete.")


