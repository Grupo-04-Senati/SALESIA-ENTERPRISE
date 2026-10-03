"""Reportes: generación, consulta, exportación CSV y vista imprimible (RF-20)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.report import ReportCreate
from app.services import report_service

router = APIRouter(prefix='/reports', tags=['reports'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Analista')


@router.get('')
def list_reports(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return report_service.list_reports(db, company_id_of(user), page=page, page_size=page_size)


@router.post('', status_code=status.HTTP_201_CREATED)
def generate_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return report_service.generate(db, company_id_of(actor), payload, actor=actor)


@router.get('/{report_id}')
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return report_service.get_report(db, company_id_of(user), report_id)


@router.get('/{report_id}/export')
def export_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    format: str = Query(default='csv', pattern='^(csv|pdf|xlsx)$'),
):
    report = report_service.get_report(db, company_id_of(user), report_id)
    if format != 'csv':
        # PDF/XLSX quedan fuera del alcance de FASE 05 (docs/05 §2.10).
        report = dict(report)
        report['format'] = format
        return report

    content, filename = report_service.export_csv(report)
    return Response(
        content='﻿' + content,
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.get('/{report_id}/print')
def print_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    """Vista imprimible: devuelve el reporte completo para renderizarlo."""
    return report_service.get_report(db, company_id_of(user), report_id)
