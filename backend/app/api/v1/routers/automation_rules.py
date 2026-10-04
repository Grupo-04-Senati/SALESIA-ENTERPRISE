"""Reglas de automatización: CRUD con código único por empresa (BE-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.system import AutomationRuleCreate, AutomationRuleUpdate
from app.services import analytics_extra_service

router = APIRouter(prefix='/automation-rules', tags=['automation-rules'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_automation_rules(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return analytics_extra_service.list_automation_rules(
        db, company_id_of(user), page=page, page_size=page_size
    )


@router.get('/{rule_id}')
def get_automation_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return analytics_extra_service.get_automation_rule(db, company_id_of(user), rule_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_automation_rule(
    payload: AutomationRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.create_automation_rule(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{rule_id}')
def update_automation_rule(
    rule_id: int,
    payload: AutomationRuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.update_automation_rule(
        db, company_id_of(actor), rule_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{rule_id}')
def delete_automation_rule(
    rule_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Baja lógica (is_active=False) por Convenciones COMUNES §1."""
    return analytics_extra_service.deactivate_automation_rule(
        db, company_id_of(actor), rule_id, actor=actor, ip=_ip(request)
    )
