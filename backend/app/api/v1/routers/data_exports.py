"""Exportaciones de datos: generación de archivos por tipo y borrado (BE-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.system import DataExportCreate
from app.services import system_service

router = APIRouter(prefix='/data-exports', tags=['data-exports'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_data_exports(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return system_service.list_data_exports(db, company_id_of(user), page=page, page_size=page_size)


@router.get('/{export_id}')
def get_data_export(
    export_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return system_service.get_data_export(db, company_id_of(user), export_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_data_export(
    payload: DataExportCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return system_service.create_data_export(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{export_id}')
def delete_data_export(
    export_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return system_service.delete_data_export(
        db, company_id_of(actor), export_id, actor=actor, ip=_ip(request)
    )
