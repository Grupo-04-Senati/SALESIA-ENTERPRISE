"""Analítica: reportes programados, reglas de automatización e instantáneas de KPI (BE-3)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound, ValidationAppError
from app.models.analytics_extra import AutomationRule, KpiSnapshot, ScheduledReport
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale
from app.schemas.system import (
    AutomationRuleCreate,
    AutomationRuleUpdate,
    KpiSnapshotCreate,
    ScheduledReportCreate,
    ScheduledReportUpdate,
)
from app.services.audit_service import write_audit
from app.utils.helpers import as_float, clamp_page, paginate


def _is_active(payload_status: Optional[str], default: bool = True) -> bool:
    if payload_status is None:
        return default
    return payload_status == 'active'


def _serialize_report(report: ScheduledReport) -> dict:
    return {
        'id': report.id,
        'report_type': report.report_type,
        'title': report.title,
        'parameters': report.parameters,
        'frequency': report.frequency,
        'next_run_at': report.next_run_at,
        'status': 'active' if report.is_active else 'inactive',
        'created_at': report.created_at,
    }


def _serialize_rule(rule: AutomationRule) -> dict:
    return {
        'id': rule.id,
        'code': rule.code,
        'name': rule.name,
        'description': rule.description,
        'condition': rule.condition,
        'action': rule.action,
        'severity': rule.severity,
        'status': 'active' if rule.is_active else 'inactive',
        'created_at': rule.created_at,
    }


def _serialize_snapshot(snapshot: KpiSnapshot) -> dict:
    return {
        'id': snapshot.id,
        'kpi_code': snapshot.kpi_code,
        'period_start': snapshot.period_start,
        'period_end': snapshot.period_end,
        'value': as_float(snapshot.value),
        'payload': snapshot.payload,
        'created_at': snapshot.created_at,
    }


# ---------------------------------------------------------------- reportes


def list_scheduled_reports(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    reports = db.execute(
        select(ScheduledReport)
        .where(ScheduledReport.company_id == company_id)
        .order_by(ScheduledReport.id.desc())
    ).scalars().all()
    payload = [_serialize_report(report) for report in reports]
    return paginate(payload, page, page_size)


def get_scheduled_report(db: Session, company_id: int, report_id: int) -> dict:
    report = _find_report(db, company_id, report_id)
    return _serialize_report(report)


def _find_report(db: Session, company_id: int, report_id: int) -> ScheduledReport:
    report = db.execute(
        select(ScheduledReport).where(
            ScheduledReport.id == report_id, ScheduledReport.company_id == company_id
        )
    ).scalar_one_or_none()
    if report is None:
        raise NotFound('Reporte programado no encontrado.')
    return report


def create_scheduled_report(
    db: Session, company_id: int, payload: ScheduledReportCreate, actor=None, ip: Optional[str] = None
) -> dict:
    report = ScheduledReport(
        company_id=company_id,
        report_type=payload.report_type,
        title=payload.title,
        parameters=payload.parameters,
        frequency=payload.frequency,
        next_run_at=payload.next_run_at,
        is_active=_is_active(payload.status),
        created_by=actor.id if actor else None,
    )
    db.add(report)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='scheduled_report.create',
        entity='reportes_programados',
        entity_id=report.id,
        detail={'report_type': payload.report_type, 'title': payload.title},
        ip_address=ip,
    )
    db.commit()
    return _serialize_report(report)


def update_scheduled_report(
    db: Session,
    company_id: int,
    report_id: int,
    payload: ScheduledReportUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    report = _find_report(db, company_id, report_id)

    # PUT parcial: solo se actualizan los campos enviados (exclude_unset).
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == 'status':
            if value is not None:
                report.is_active = _is_active(value)
        else:
            setattr(report, field, value)

    write_audit(
        db,
        user=actor,
        action='scheduled_report.update',
        entity='reportes_programados',
        entity_id=report.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_report(report)


def deactivate_scheduled_report(
    db: Session, company_id: int, report_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Baja lógica: el modelo tiene is_active (Convenciones COMUNES §1)."""
    report = _find_report(db, company_id, report_id)

    report.is_active = False
    write_audit(
        db,
        user=actor,
        action='scheduled_report.delete',
        entity='reportes_programados',
        entity_id=report.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_report(report)


# ---------------------------------------------------------- reglas de automatización


def list_automation_rules(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rules = db.execute(
        select(AutomationRule)
        .where(AutomationRule.company_id == company_id)
        .order_by(AutomationRule.id.desc())
    ).scalars().all()
    payload = [_serialize_rule(rule) for rule in rules]
    return paginate(payload, page, page_size)


def _find_rule(db: Session, company_id: int, rule_id: int) -> AutomationRule:
    rule = db.execute(
        select(AutomationRule).where(
            AutomationRule.id == rule_id, AutomationRule.company_id == company_id
        )
    ).scalar_one_or_none()
    if rule is None:
        raise NotFound('Regla de automatización no encontrada.')
    return rule


def get_automation_rule(db: Session, company_id: int, rule_id: int) -> dict:
    return _serialize_rule(_find_rule(db, company_id, rule_id))


def _check_code(
    db: Session, company_id: int, code: str, rule_id: Optional[int] = None
) -> None:
    statement = select(AutomationRule).where(
        AutomationRule.company_id == company_id, AutomationRule.code == code
    )
    if rule_id is not None:
        statement = statement.where(AutomationRule.id != rule_id)
    if db.execute(statement).scalar_one_or_none():
        raise Conflict('Ya existe una regla de automatización con ese código.')


def create_automation_rule(
    db: Session, company_id: int, payload: AutomationRuleCreate, actor=None, ip: Optional[str] = None
) -> dict:
    _check_code(db, company_id, payload.code)

    rule = AutomationRule(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        condition=payload.condition,
        action=payload.action,
        severity=payload.severity,
        is_active=_is_active(payload.status),
    )
    db.add(rule)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='automation_rule.create',
        entity='reglas_automatizacion',
        entity_id=rule.id,
        detail={'code': payload.code, 'name': payload.name},
        ip_address=ip,
    )
    db.commit()
    return _serialize_rule(rule)


def update_automation_rule(
    db: Session,
    company_id: int,
    rule_id: int,
    payload: AutomationRuleUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    rule = _find_rule(db, company_id, rule_id)

    # PUT parcial: solo se actualizan los campos enviados (exclude_unset).
    data = payload.model_dump(exclude_unset=True)
    if 'code' in data and data['code'] != rule.code:
        _check_code(db, company_id, data['code'], rule_id=rule.id)
    for field, value in data.items():
        if field == 'status':
            if value is not None:
                rule.is_active = _is_active(value)
        else:
            setattr(rule, field, value)

    write_audit(
        db,
        user=actor,
        action='automation_rule.update',
        entity='reglas_automatizacion',
        entity_id=rule.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_rule(rule)


def deactivate_automation_rule(
    db: Session, company_id: int, rule_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Baja lógica: el modelo tiene is_active (Convenciones COMUNES §1)."""
    rule = _find_rule(db, company_id, rule_id)

    rule.is_active = False
    write_audit(
        db,
        user=actor,
        action='automation_rule.delete',
        entity='reglas_automatizacion',
        entity_id=rule.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_rule(rule)


# ---------------------------------------------------------- instantáneas de KPI


def list_kpi_snapshots(
    db: Session, company_id: int, *, kpi_code: str = '', page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(KpiSnapshot).where(KpiSnapshot.company_id == company_id)
    if kpi_code:
        statement = statement.where(KpiSnapshot.kpi_code == kpi_code)

    snapshots = db.execute(statement.order_by(KpiSnapshot.id.desc())).scalars().all()
    payload = [_serialize_snapshot(snapshot) for snapshot in snapshots]
    return paginate(payload, page, page_size)


def get_kpi_snapshot(db: Session, company_id: int, snapshot_id: int) -> dict:
    snapshot = _find_snapshot(db, company_id, snapshot_id)
    return _serialize_snapshot(snapshot)


def _find_snapshot(db: Session, company_id: int, snapshot_id: int) -> KpiSnapshot:
    snapshot = db.execute(
        select(KpiSnapshot).where(
            KpiSnapshot.id == snapshot_id, KpiSnapshot.company_id == company_id
        )
    ).scalar_one_or_none()
    if snapshot is None:
        raise NotFound('Instantánea de KPI no encontrada.')
    return snapshot


def _parse_period(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationAppError(f'El campo {field} debe tener formato YYYY-MM-DD.')


def _sale_scope(company_id: int, start: date, end: date) -> list:
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return [
        Sale.company_id == company_id,
        Sale.status != 'cancelled',
        Sale.sold_at >= start_dt,
        Sale.sold_at < end_dt,
    ]


def _compute_kpi(db: Session, company_id: int, kpi_code: str, start: date, end: date) -> float:
    if kpi_code in ('revenue', 'sales_count', 'avg_ticket'):
        scope = _sale_scope(company_id, start, end)
        revenue = float(
            db.execute(select(func.coalesce(func.sum(Sale.total), 0)).where(*scope)).scalar_one()
            or 0
        )
        count = int(db.execute(select(func.count(Sale.id)).where(*scope)).scalar_one() or 0)
        if kpi_code == 'revenue':
            return round(revenue, 4)
        if kpi_code == 'sales_count':
            return float(count)
        return round(revenue / count, 4) if count else 0.0

    if kpi_code == 'customers':
        return float(
            db.execute(
                select(func.count(Customer.id)).where(Customer.company_id == company_id)
            ).scalar_one()
            or 0
        )

    if kpi_code == 'low_stock':
        return float(
            db.execute(
                select(func.count(Inventory.id))
                .join(Product, Inventory.product_id == Product.id)
                .where(Product.company_id == company_id, Inventory.stock < Inventory.min_stock)
            ).scalar_one()
            or 0
        )

    raise ValidationAppError(f'KPI no soportado: {kpi_code}.')


def create_kpi_snapshot(
    db: Session, company_id: int, payload: KpiSnapshotCreate, actor=None, ip: Optional[str] = None
) -> dict:
    period_start = _parse_period(payload.period_start, 'period_start')
    period_end = _parse_period(payload.period_end, 'period_end')

    computed = payload.value is None
    if computed:
        value = _compute_kpi(db, company_id, payload.kpi_code, period_start, period_end)
        snapshot_payload = {'computed': True}
    else:
        value = float(payload.value)
        snapshot_payload = None

    snapshot = KpiSnapshot(
        company_id=company_id,
        kpi_code=payload.kpi_code,
        period_start=period_start,
        period_end=period_end,
        value=round(value, 4),
        payload=snapshot_payload,
    )
    db.add(snapshot)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='kpi_snapshot.create',
        entity='instantaneas_kpi',
        entity_id=snapshot.id,
        detail={
            'kpi_code': payload.kpi_code,
            'period_start': payload.period_start,
            'period_end': payload.period_end,
            'value': as_float(snapshot.value),
            'computed': computed,
        },
        ip_address=ip,
    )
    db.commit()
    return _serialize_snapshot(snapshot)


def delete_kpi_snapshot(
    db: Session, company_id: int, snapshot_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    snapshot = _find_snapshot(db, company_id, snapshot_id)

    write_audit(
        db,
        user=actor,
        action='kpi_snapshot.delete',
        entity='instantaneas_kpi',
        entity_id=snapshot.id,
        ip_address=ip,
    )
    db.delete(snapshot)
    db.commit()
    return {'id': snapshot_id, 'deleted': True}
