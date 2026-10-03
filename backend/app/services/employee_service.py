"""Vendedores/empleados y sus métricas comerciales (RF-05 · RN-07, RN-08)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound
from app.models.employee import Employee
from app.models.sale import Sale
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate


def _serialize(employee: Employee, metrics: Optional[dict] = None) -> dict:
    return {
        'id': employee.id,
        'full_name': employee.full_name,
        'name': employee.full_name,
        'document': employee.document,
        'position': employee.position or 'Vendedor',
        'phone': employee.phone or '',
        'email': employee.email or '',
        'hire_date': employee.hire_date,
        'hired_at': employee.hire_date,
        'status': 'active' if employee.is_active else 'inactive',
        'created_at': employee.created_at,
        'metrics': metrics,
    }


def _metrics(db: Session, company_id: int, employee_id: int) -> dict:
    """RN-08: métricas solo sobre ventas no anuladas."""
    count, revenue = db.execute(
        select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == company_id,
            Sale.seller_id == employee_id,
            Sale.status != 'cancelled',
        )
    ).one()
    revenue = float(revenue or 0)
    return {
        'sales': count,
        'revenue': round(revenue, 2),
        'average_ticket': round(revenue / count, 2) if count else 0.0,
    }


def list_employees(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20, with_metrics: bool = True
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Employee).where(Employee.company_id == company_id).order_by(Employee.full_name)
    ).scalars().all()
    payload = [
        _serialize(row, _metrics(db, company_id, row.id) if with_metrics else None) for row in rows
    ]
    return paginate(payload, page, page_size)


def get_employee(db: Session, company_id: int, employee_id: int) -> dict:
    employee = db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.company_id == company_id)
    ).scalar_one_or_none()
    if employee is None:
        raise NotFound('Vendedor no encontrado.')
    return _serialize(employee, _metrics(db, company_id, employee.id))


def create_employee(
    db: Session, company_id: int, payload: EmployeeCreate, actor=None, ip: Optional[str] = None
) -> dict:
    if payload.document:
        duplicated = db.execute(
            select(Employee).where(Employee.document == payload.document)
        ).scalar_one_or_none()
        if duplicated:
            raise Conflict('Ya existe un empleado con ese documento.')

    employee = Employee(company_id=company_id, **payload.model_dump())
    db.add(employee)
    db.flush()
    write_audit(
        db, user=actor, action='employee.create', entity='employees', entity_id=employee.id, ip_address=ip
    )
    db.commit()
    return _serialize(employee, _metrics(db, company_id, employee.id))


def update_employee(
    db: Session,
    company_id: int,
    employee_id: int,
    payload: EmployeeUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    employee = db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.company_id == company_id)
    ).scalar_one_or_none()
    if employee is None:
        raise NotFound('Vendedor no encontrado.')

    for field, value in payload.model_dump().items():
        setattr(employee, field, value)

    write_audit(
        db, user=actor, action='employee.update', entity='employees', entity_id=employee.id, ip_address=ip
    )
    db.commit()
    return _serialize(employee, _metrics(db, company_id, employee.id))


def delete_employee(
    db: Session,
    company_id: int,
    employee_id: int,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """Baja lógica del vendedor: conserva su historial de ventas (RN-07)."""
    employee = db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.company_id == company_id)
    ).scalar_one_or_none()
    if employee is None:
        raise NotFound('Vendedor no encontrado.')
    if not employee.is_active:
        raise Conflict('El vendedor ya está desactivado.')

    employee.is_active = False
    write_audit(
        db, user=actor, action='employee.delete', entity='employees', entity_id=employee.id, ip_address=ip
    )
    db.commit()
    return {'id': employee.id, 'deleted': True}
