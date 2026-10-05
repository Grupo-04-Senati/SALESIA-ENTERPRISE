"""Auditoría de operaciones críticas (RF-22 · RN-34 · RNF-07)."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def write_audit(
    db: Session,
    *,
    user: Optional[User],
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    detail: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    company_id: Optional[int] = None,
    commit: bool = False,
) -> AuditLog:
    """Registra una acción sensible. Nunca guarda contraseñas ni tokens."""
    entry = AuditLog(
        company_id=company_id if company_id is not None else (user.company_id if user else None),
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=detail or {},
        ip_address=ip_address,
    )
    db.add(entry)
    # Notificaciones automáticas del módulo afectado (best-effort, jamás rompe).
    from app.services.notification_bridge import notify_from_audit

    notify_from_audit(db, entry=entry, actor=user)
    if commit:
        db.commit()
        db.refresh(entry)
    return entry
