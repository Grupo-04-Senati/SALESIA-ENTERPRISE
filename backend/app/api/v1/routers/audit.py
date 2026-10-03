"""Auditoría: bitácora de acciones críticas (RF-22 · RN-34 · RNF-07)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.statistics_service import _parse_date
from app.utils.helpers import clamp_page, paginate

router = APIRouter(prefix='/audit-logs', tags=['audit'])

access_roles = ('Admin', 'Gerente')


def _serialize(row: AuditLog, actor: Optional[User]) -> dict:
    return {
        'id': row.id,
        'user': {'id': actor.id, 'name': actor.full_name} if actor else None,
        'action': row.action,
        'entity': row.entity,
        'entity_id': row.entity_id,
        'detail': row.detail or {},
        'ip_address': row.ip_address,
        'created_at': row.created_at,
    }


@router.get('')
def list_audit_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*access_roles)),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    action: str = Query(default=''),
    user_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    page, page_size = clamp_page(page, page_size)
    statement = select(AuditLog).where(AuditLog.company_id == company_id_of(user))
    if date_from:
        statement = statement.where(AuditLog.created_at >= _parse_date(date_from))
    if date_to:
        statement = statement.where(AuditLog.created_at <= _parse_date(date_to, end=True))
    if action:
        statement = statement.where(AuditLog.action.ilike(f'%{action}%'))
    if user_id:
        statement = statement.where(AuditLog.user_id == user_id)

    rows = (
        db.execute(
            statement.outerjoin(User, User.id == AuditLog.user_id)
            .add_columns(User)
            .order_by(AuditLog.created_at.desc())
            .limit(5000)
        ).all()
    )
    return paginate([_serialize(row, actor) for row, actor in rows], page, page_size)
