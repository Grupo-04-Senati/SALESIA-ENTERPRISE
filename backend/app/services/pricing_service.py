"""Listas de precios y promociones (docs/04 §2.4)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound, ValidationAppError
from app.models.pricing import PriceList, PriceListItem, ProductPromotion, Promotion
from app.models.product import Product
from app.schemas.pricing import (
    PriceListCreate,
    PriceListItemsPayload,
    PriceListUpdate,
    PromotionCreate,
    PromotionUpdate,
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


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """ISO8601 tolerante al sufijo 'Z' (fechas de promociones)."""
    if not value:
        return None
    return datetime.fromisoformat(value.strip().replace('Z', '+00:00'))


def _validate_products(db: Session, company_id: int, product_ids: List[int]) -> None:
    existing = set(
        db.execute(
            select(Product.id).where(
                Product.company_id == company_id, Product.id.in_(product_ids)
            )
        ).scalars().all()
    )
    for product_id in product_ids:
        if product_id not in existing:
            raise NotFound(f'Producto {product_id} no encontrado.')


def _unique_products(product_ids: List[int]) -> List[int]:
    unique = list(dict.fromkeys(product_ids))
    if len(unique) != len(product_ids):
        raise Conflict('Hay productos repetidos.')
    return unique


# --------------------------------------------------------------- listas de precios


def _item_counts(db: Session, company_id: int) -> Dict[int, int]:
    rows = db.execute(
        select(PriceListItem.price_list_id, func.count(PriceListItem.id))
        .join(PriceList, PriceList.id == PriceListItem.price_list_id)
        .where(PriceList.company_id == company_id)
        .group_by(PriceListItem.price_list_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _serialize_price_list(price_list: PriceList, counts: Dict[int, int]) -> dict:
    return {
        'id': price_list.id,
        'name': price_list.name,
        'currency': price_list.currency,
        'status': _status_of(price_list.is_active),
        'item_count': counts.get(price_list.id, 0),
        'created_at': price_list.created_at,
    }


def _items(db: Session, company_id: int, price_list_id: int) -> List[dict]:
    rows = db.execute(
        select(PriceListItem, Product.name)
        .join(Product, Product.id == PriceListItem.product_id)
        .where(
            PriceListItem.price_list_id == price_list_id, Product.company_id == company_id
        )
        .order_by(Product.name)
    ).all()
    return [
        {
            'id': item.id,
            'product_id': item.product_id,
            'product_name': product_name,
            'price': as_float(item.price),
        }
        for item, product_name in rows
    ]


def _get_price_list(db: Session, company_id: int, price_list_id: int) -> PriceList:
    price_list = db.execute(
        select(PriceList).where(
            PriceList.id == price_list_id, PriceList.company_id == company_id
        )
    ).scalar_one_or_none()
    if price_list is None:
        raise NotFound('Lista de precios no encontrada.')
    return price_list


def list_price_lists(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(PriceList).where(PriceList.company_id == company_id).order_by(PriceList.name)
    ).scalars().all()
    counts = _item_counts(db, company_id)
    return paginate([_serialize_price_list(row, counts) for row in rows], page, page_size)


def get_price_list(db: Session, company_id: int, price_list_id: int) -> dict:
    price_list = _get_price_list(db, company_id, price_list_id)
    data = _serialize_price_list(price_list, _item_counts(db, company_id))
    data['items'] = _items(db, company_id, price_list.id)
    return data


def create_price_list(
    db: Session, company_id: int, payload: PriceListCreate, actor=None, ip: Optional[str] = None
) -> dict:
    price_list = PriceList(
        company_id=company_id,
        name=payload.name,
        currency=payload.currency,
        is_active=_to_active(payload.status),
    )
    db.add(price_list)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='price_list.create',
        entity='listas_precios',
        entity_id=price_list.id,
        detail={'name': price_list.name},
        ip_address=ip,
    )
    db.commit()
    return _serialize_price_list(price_list, {})


def update_price_list(
    db: Session,
    company_id: int,
    price_list_id: int,
    payload: PriceListUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    price_list = _get_price_list(db, company_id, price_list_id)

    data = payload.model_dump(exclude_unset=True)
    fields = sorted(data.keys())
    status = data.pop('status', None)
    for field, value in data.items():
        setattr(price_list, field, value)
    if status is not None:
        price_list.is_active = _to_active(status)

    write_audit(
        db,
        user=actor,
        action='price_list.update',
        entity='listas_precios',
        entity_id=price_list.id,
        detail={'fields': fields},
        ip_address=ip,
    )
    db.commit()
    return get_price_list(db, company_id, price_list_id)


def replace_price_list_items(
    db: Session,
    company_id: int,
    price_list_id: int,
    payload: PriceListItemsPayload,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    price_list = _get_price_list(db, company_id, price_list_id)

    product_ids = [item.product_id for item in payload.items]
    product_ids = _unique_products(product_ids)
    _validate_products(db, company_id, product_ids)

    existing = {
        row.product_id: row
        for row in db.execute(
            select(PriceListItem).where(PriceListItem.price_list_id == price_list.id)
        ).scalars().all()
    }
    keep = set(product_ids)
    for product_id, row in existing.items():
        if product_id not in keep:
            db.delete(row)
    for item in payload.items:
        row = existing.get(item.product_id)
        if row is None:
            db.add(
                PriceListItem(
                    price_list_id=price_list.id,
                    product_id=item.product_id,
                    price=Decimal(str(item.price)),
                )
            )
        else:
            row.price = Decimal(str(item.price))

    write_audit(
        db,
        user=actor,
        action='price_list.items',
        entity='listas_precios',
        entity_id=price_list.id,
        detail={'items': len(product_ids)},
        ip_address=ip,
    )
    db.commit()
    return get_price_list(db, company_id, price_list_id)


def deactivate_price_list(
    db: Session, company_id: int, price_list_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    price_list = _get_price_list(db, company_id, price_list_id)
    price_list.is_active = False
    write_audit(
        db,
        user=actor,
        action='price_list.delete',
        entity='listas_precios',
        entity_id=price_list.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_price_list(price_list, _item_counts(db, company_id))


# ------------------------------------------------------------------------ promociones


def _promotion_counts(db: Session, company_id: int) -> Dict[int, int]:
    rows = db.execute(
        select(ProductPromotion.promotion_id, func.count(ProductPromotion.id))
        .join(Promotion, Promotion.id == ProductPromotion.promotion_id)
        .where(Promotion.company_id == company_id)
        .group_by(ProductPromotion.promotion_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _serialize_promotion(promotion: Promotion, counts: Dict[int, int]) -> dict:
    return {
        'id': promotion.id,
        'name': promotion.name,
        'kind': promotion.kind,
        'value': as_float(promotion.value),
        'starts_at': promotion.starts_at,
        'ends_at': promotion.ends_at,
        'status': _status_of(promotion.is_active),
        'product_count': counts.get(promotion.id, 0),
    }


def _validate_kind_value(kind: str, value: float) -> None:
    if kind not in ('percent', 'fixed'):
        raise ValidationAppError('Tipo de promoción no válido.')
    if value <= 0:
        raise ValidationAppError('El valor de la promoción debe ser mayor a cero.')
    if kind == 'percent' and value > 100:
        raise ValidationAppError('El porcentaje de la promoción no puede superar 100.')


def _get_promotion(db: Session, company_id: int, promotion_id: int) -> Promotion:
    promotion = db.execute(
        select(Promotion).where(
            Promotion.id == promotion_id, Promotion.company_id == company_id
        )
    ).scalar_one_or_none()
    if promotion is None:
        raise NotFound('Promoción no encontrada.')
    return promotion


def list_promotions(
    db: Session, company_id: int, *, status: str = '', page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Promotion).where(Promotion.company_id == company_id)

    if status == 'active':
        statement = statement.where(Promotion.is_active.is_(True))
    elif status == 'inactive':
        statement = statement.where(Promotion.is_active.is_(False))

    rows = db.execute(statement.order_by(Promotion.name)).scalars().all()
    counts = _promotion_counts(db, company_id)
    return paginate([_serialize_promotion(row, counts) for row in rows], page, page_size)


def get_promotion(db: Session, company_id: int, promotion_id: int) -> dict:
    promotion = _get_promotion(db, company_id, promotion_id)
    return _serialize_promotion(promotion, _promotion_counts(db, company_id))


def create_promotion(
    db: Session, company_id: int, payload: PromotionCreate, actor=None, ip: Optional[str] = None
) -> dict:
    _validate_kind_value(payload.kind, payload.value)
    product_ids = _unique_products(payload.product_ids)
    _validate_products(db, company_id, product_ids)

    promotion = Promotion(
        company_id=company_id,
        name=payload.name,
        kind=payload.kind,
        value=Decimal(str(payload.value)),
        starts_at=_parse_dt(payload.starts_at),
        ends_at=_parse_dt(payload.ends_at),
        is_active=_to_active(payload.status),
    )
    db.add(promotion)
    db.flush()
    for product_id in product_ids:
        db.add(ProductPromotion(promotion_id=promotion.id, product_id=product_id))

    write_audit(
        db,
        user=actor,
        action='promotion.create',
        entity='promociones',
        entity_id=promotion.id,
        detail={'name': promotion.name, 'products': len(product_ids)},
        ip_address=ip,
    )
    db.commit()
    return _serialize_promotion(promotion, _promotion_counts(db, company_id))


def update_promotion(
    db: Session,
    company_id: int,
    promotion_id: int,
    payload: PromotionUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    promotion = _get_promotion(db, company_id, promotion_id)
    _validate_kind_value(payload.kind, payload.value)

    data = payload.model_dump(exclude_unset=True)
    status = data.pop('status', None)
    product_ids_raw = data.pop('product_ids', None)

    if 'starts_at' in data:
        data['starts_at'] = _parse_dt(data['starts_at'])
    if 'ends_at' in data:
        data['ends_at'] = _parse_dt(data['ends_at'])

    if product_ids_raw is None:
        product_ids = None
    else:
        product_ids = _unique_products(product_ids_raw)
        _validate_products(db, company_id, product_ids)

    for field, value in data.items():
        setattr(promotion, field, value)
    if status is not None:
        promotion.is_active = _to_active(status)
    if product_ids is not None:
        db.execute(
            delete(ProductPromotion).where(ProductPromotion.promotion_id == promotion.id)
        )
        for product_id in product_ids:
            db.add(ProductPromotion(promotion_id=promotion.id, product_id=product_id))

    write_audit(
        db,
        user=actor,
        action='promotion.update',
        entity='promociones',
        entity_id=promotion.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_promotion(promotion, _promotion_counts(db, company_id))


def deactivate_promotion(
    db: Session, company_id: int, promotion_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    promotion = _get_promotion(db, company_id, promotion_id)
    promotion.is_active = False
    write_audit(
        db,
        user=actor,
        action='promotion.delete',
        entity='promociones',
        entity_id=promotion.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_promotion(promotion, _promotion_counts(db, company_id))
