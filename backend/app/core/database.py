"""Conexión a PostgreSQL (Supabase pooler) y sesión SQLAlchemy."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base declarativa de todos los modelos (54 entidades de docs/04)."""


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: una sesión por petición, cerrada al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
