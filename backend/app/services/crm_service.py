"""Segmentos e interacciones con clientes (docs/04 §2.4)."""

from __future__ import annotations

from typing import Dict, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound, ValidationAppError
from app.models.crm import CustomerInteraction, CustomerSegment
from app.models.customer import Customer
from app.models.user import User
from app.schemas.crm import (
    CustomerInteractionCreate,
    CustomerInteractionUpdate,
    CustomerSegmentCreate,
    CustomerSegmentUpdate,
)
from app.services.audit_service import write_audit
from app.utils.helpers import as_float, clamp_page, paginate


def _status_of(is_active: bool) -> str:
    return 'active' if is_active else 'inactive'


def _to_active(status: Optional[str]) -> bool:
    """'active'/'inactive' → is_active; vacío → activo."""
    if status is None or status == '':
        return True
    if status not in ('active', 'inactive'):
        raise ValidationAppError('Estado no válido.')
    return status == 'active'


# --------------------------------------------------------------------------- segmentos


def _segment_counts(db: Session, company_id: int) -> Dict[str, int]:
    rows = db.execute(
        select(Customer.segment, func.count(Customer.id)).where(
            Customer.company_id == company_id
        ).group_by(Customer.segment)
    ).all()
    return {row[0]: row[1] for row in rows}


def _serialize_segment(segment: CustomerSegment, counts: Dict[str, int]) -> dict:
    return {
        'id': segment.id,
        'name': segment.name,
        'description': segment.description or '',
        'min_purchases': segment.min_purchases,
        'min_total': as_float(segment.min_total),
        'status': _status_of(segment.is_active),
        'customer_count': counts.get(segment.name, 0),
    }


def _get_segment(db: Session, company_id: int, segment_id: int) -> CustomerSegment:
    segment = db.execute(
        select(CustomerSegment).where(
            CustomerSegment.id == segment_id, CustomerSegment.company_id == company_id
        )
    ).scalar_one_or_none()
    if segment is None:
        raise NotFound('Segmento no encontrado.')
    return segment


def _check_duplicated_name(
    db: Session, company_id: int, name: str, segment_id: Optional[int] = None
) -> None:
    statement = select(CustomerSegment).where(
        CustomerSegment.company_id == company_id, CustomerSegment.name == name
    )
    if segment_id is not None:
        statement = statement.where(CustomerSegment.id != segment_id)
    if db.execute(statement).scalar_one_or_none():
        raise Conflict('Ya existe un segmento con ese nombre.')


def list_segments(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(CustomerSegment)
        .where(CustomerSegment.company_id == company_id)
        .order_by(CustomerSegment.name)
    ).scalars().all()
    counts = _segment_counts(db, company_id)
    return paginate([_serialize_segment(row, counts) for row in rows], page, page_size)


def get_segment(db: Session, company_id: int, segment_id: int) -> dict:
    segment = _get_segment(db, company_id, segment_id)
    return _serialize_segment(segment, _segment_counts(db, company_id))


def create_segment(
    db: Session,
    company_id: int,
    payload: CustomerSegmentCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    _check_duplicated_name(db, company_id, payload.name)

    segment = CustomerSegment(
        company_id=company_id,
        name=payload.name,
        description=payload.description,
        min_purchases=payload.min_purchases,
        min_total=payload.min_total,
        is_active=_to_active(payload.status),
    )
    db.add(segment)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='segment.create',
        entity='segmentos_clientes',
        entity_id=segment.id,
        detail={'name': segment.name},
        ip_address=ip,
    )
    db.commit()
    return _serialize_segment(segment, _segment_counts(db, company_id))


def update_segment(
    db: Session,
    company_id: int,
    segment_id: int,
    payload: CustomerSegmentUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    segment = _get_segment(db, company_id, segment_id)
    _check_duplicated_name(db, company_id, payload.name, segment_id)

    data = payload.model_dump(exclude_unset=True)
    status = data.pop('status', None)
    for field, value in data.items():
        setattr(segment, field, value)
    if status is not None:
        segment.is_active = _to_active(status)

    write_audit(
        db,
        user=actor,
        action='segment.update',
        entity='segmentos_clientes',
        entity_id=segment.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_segment(segment, _segment_counts(db, company_id))


def deactivate_segment(
    db: Session, company_id: int, segment_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    segment = _get_segment(db, company_id, segment_id)
    segment.is_active = False
    write_audit(
        db,
        user=actor,
        action='segment.delete',
        entity='segmentos_clientes',
        entity_id=segment.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_segment(segment, _segment_counts(db, company_id))


# ----------------------------------------------------------------------- interacciones


def _serialize_interaction(
    interaction: CustomerInteraction, customer_name: str, performed_by_name: str
) -> dict:
    return {
        'id': interaction.id,
        'customer_id': interaction.customer_id,
        'customer_name': customer_name,
        'kind': interaction.kind,
        'subject': interaction.subject,
        'notes': interaction.notes or '',
        'occurred_at': interaction.occurred_at,
        'performed_by': interaction.performed_by,
        'performed_by_name': performed_by_name,
    }


def _get_interaction(db: Session, company_id: int, interaction_id: int) -> CustomerInteraction:
    interaction = db.execute(
        select(CustomerInteraction).where(
            CustomerInteraction.id == interaction_id,
            CustomerInteraction.company_id == company_id,
        )
    ).scalar_one_or_none()
    if interaction is None:
        raise NotFound('Interacción no encontrada.')
    return interaction


def _customer_or_404(db: Session, company_id: int, customer_id: int) -> Customer:
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')
    return customer


def list_interactions(
    db: Session,
    company_id: int,
    *,
    customer_id: Optional[int] = None,
    kind: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(CustomerInteraction, Customer.name, User.full_name)
        .join(Customer, Customer.id == CustomerInteraction.customer_id)
        .outerjoin(
            User, and_(User.id == CustomerInteraction.performed_by, User.company_id == company_id)
        )
        .where(CustomerInteraction.company_id == company_id)
    )
    if customer_id:
        statement = statement.where(CustomerInteraction.customer_id == customer_id)
    if kind:
        statement = statement.where(CustomerInteraction.kind == kind)

    rows = db.execute(
        statement.order_by(CustomerInteraction.occurred_at.desc())
    ).all()
    payload = [
        _serialize_interaction(interaction, customer_name, user_name or '')
        for interaction, customer_name, user_name in rows
    ]
    return paginate(payload, page, page_size)


def get_interaction(db: Session, company_id: int, interaction_id: int) -> dict:
    interaction = _get_interaction(db, company_id, interaction_id)
    customer = _customer_or_404(db, company_id, interaction.customer_id)
    performed_by_name = ''
    if interaction.performed_by:
        performed_by_name = db.execute(
            select(User.full_name).where(
                User.id == interaction.performed_by, User.company_id == company_id
            )
        ).scalar_one_or_none() or ''
    return _serialize_interaction(interaction, customer.name, performed_by_name)


def create_interaction(
    db: Session,
    company_id: int,
    payload: CustomerInteractionCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    customer = _customer_or_404(db, company_id, payload.customer_id)

    interaction = CustomerInteraction(
        company_id=company_id,
        customer_id=customer.id,
        kind=payload.kind,
        subject=payload.subject,
        notes=payload.notes,
        performed_by=actor.id if actor else None,
    )
    if payload.occurred_at is not None:
        interaction.occurred_at = payload.occurred_at

    db.add(interaction)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='interaction.create',
        entity='interacciones_clientes',
        entity_id=interaction.id,
        detail={'customer_id': customer.id, 'kind': payload.kind},
        ip_address=ip,
    )
    db.commit()
    return _serialize_interaction(interaction, customer.name, actor.full_name if actor else '')


def update_interaction(
    db: Session,
    company_id: int,
    interaction_id: int,
    payload: CustomerInteractionUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    interaction = _get_interaction(db, company_id, interaction_id)
    customer = _customer_or_404(db, company_id, payload.customer_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interaction, field, value)

    write_audit(
        db,
        user=actor,
        action='interaction.update',
        entity='interacciones_clientes',
        entity_id=interaction.id,
        detail={'customer_id': customer.id},
        ip_address=ip,
    )
    db.commit()
    return get_interaction(db, company_id, interaction_id)


def delete_interaction(
    db: Session, company_id: int, interaction_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    interaction = _get_interaction(db, company_id, interaction_id)
    interaction_id_saved = interaction.id

    write_audit(
        db,
        user=actor,
        action='interaction.delete',
        entity='interacciones_clientes',
        entity_id=interaction_id_saved,
        ip_address=ip,
    )
    db.delete(interaction)
    db.commit()
    return {'id': interaction_id_saved, 'deleted': True}
