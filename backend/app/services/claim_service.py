"""Reclamaciones de pedidos de la tienda (pedido no recibido o con problemas).

El cliente la abre desde «Mis pedidos»; genera notificación en el sistema y
queda listada en el detalle de venta del admin, que la marca como atendida.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, Conflict, NotFound
from app.models.claim import Claim
from app.models.customer import Customer
from app.models.sale import Sale
from app.schemas.system import NotificationCreate
from app.services import system_service
from app.services.audit_service import write_audit

logger = logging.getLogger(__name__)


def serialize_claim(claim: Claim) -> dict:
    return {
        'id': claim.id,
        'sale_id': claim.sale_id,
        'description': claim.description,
        'status': claim.status,
        'created_at': claim.created_at,
        'resolved_at': claim.resolved_at,
    }


def create_claim(
    db: Session,
    company_id: int,
    sale_id: int,
    customer: Customer,
    description: str,
    ip: str | None = None,
) -> dict:
    sale = db.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.company_id == company_id,
            Sale.customer_id == customer.id,
        )
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Pedido no encontrado.')
    if sale.status == 'cancelled':
        raise BusinessRuleError('No se puede reclamar un pedido anulado.')

    pending = db.execute(
        select(Claim).where(Claim.sale_id == sale.id, Claim.status == 'pendiente')
    ).scalars().first()
    if pending is not None:
        raise Conflict('Ya existe un reclamo pendiente para este pedido.')

    claim = Claim(
        company_id=company_id,
        sale_id=sale.id,
        customer_id=customer.id,
        description=description.strip(),
    )
    db.add(claim)
    db.flush()
    write_audit(
        db,
        user=None,
        action='claim.create',
        entity='reclamaciones',
        entity_id=claim.id,
        detail={'sale_number': sale.sale_number, 'customer': customer.name},
        ip_address=ip,
    )

    summary = claim.description if len(claim.description) <= 180 else f'{claim.description[:177]}…'
    try:
        system_service.create_notification(
            db,
            company_id,
            NotificationCreate(
                title=f'Reclamo de pedido · {sale.sale_number}',
                message=(
                    f'Cliente {customer.name}: {summary} · Pedido {sale.sale_number}. '
                    'Atender el reclamo desde el detalle de la venta.'
                ),
                level='warning',
                module='ventas',
                link=f'/ventas?sale={sale.id}',
                detail={
                    'source': 'storefront',
                    'claim_id': claim.id,
                    'sale_id': sale.id,
                    'sale_number': sale.sale_number,
                    'customer': customer.name,
                },
            ),
            actor=None,
            ip=ip,
        )
    except Exception:
        logger.exception('No se pudo crear la notificación del reclamo %s', claim.id)
        db.commit()

    db.refresh(claim)
    return serialize_claim(claim)


def resolve_claim(
    db: Session,
    company_id: int,
    claim_id: int,
    actor=None,
    ip: str | None = None,
) -> dict:
    claim = db.execute(
        select(Claim).where(Claim.id == claim_id, Claim.company_id == company_id)
    ).scalar_one_or_none()
    if claim is None:
        raise NotFound('Reclamo no encontrado.')
    if claim.status == 'atendida':
        raise BusinessRuleError('El reclamo ya está marcado como atendido.')

    claim.status = 'atendida'
    claim.resolved_at = datetime.now(timezone.utc)
    write_audit(
        db,
        user=actor,
        action='claim.resolve',
        entity='reclamaciones',
        entity_id=claim.id,
        detail={'sale_id': claim.sale_id},
        ip_address=ip,
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)
