"""Notificaciones: listado, creación, marcado de lectura y borrado (BE-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.system import NotificationCreate
from app.services import system_service

router = APIRouter(prefix='/notifications', tags=['notifications'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin',)


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    unread: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return system_service.list_notifications(
        db, company_id_of(user), unread=unread, page=page, page_size=page_size
    )


@router.get('/{notification_id}')
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return system_service.get_notification(db, company_id_of(user), notification_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return system_service.create_notification(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.post('/read-all')
def read_all_notifications(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*read_roles)),
):
    return system_service.mark_all_notifications_read(
        db, company_id_of(actor), actor=actor, ip=_ip(request)
    )


@router.patch('/{notification_id}/read')
def mark_notification_read(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*read_roles)),
):
    return system_service.mark_notification_read(
        db, company_id_of(actor), notification_id, actor=actor, ip=_ip(request)
    )


@router.delete('/{notification_id}')
def delete_notification(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return system_service.delete_notification(
        db, company_id_of(actor), notification_id, actor=actor, ip=_ip(request)
    )
