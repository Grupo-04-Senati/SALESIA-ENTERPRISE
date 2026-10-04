"""Eventos de la aplicación (tabla eventos_app): trazabilidad ligera."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.system import AppEvent


def log_app_event(
    db: Session,
    *,
    event_type: str,
    company_id: Optional[int] = None,
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    payload: Optional[dict] = None,
) -> AppEvent:
    """Anota un evento del sistema. Se persiste con el commit del llamador."""
    entry = AppEvent(
        company_id=company_id,
        event_type=event_type,
        entity=entity,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(entry)
    return entry
