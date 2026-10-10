"""Ventas: registro transaccional, pagos, anulación e historial (RF-06, RF-07).

Reglas aplicadas:
  RN-07 vendedor activo · RN-10 stock suficiente · RN-11 totales en servidor
  RN-12 numeración única · RN-13 descuento ≤ subtotal · RN-14/15/18 anulación
  RN-16 pago ≤ saldo · RN-17 estado según pagos · RN-20 stock nunca negativo
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFound, ValidationAppError
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.payment import Payment
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.schemas.sale import PaymentCreate, SaleCreate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate

TWO = Decimal('0.01')


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(TWO, rounding=ROUND_HALF_UP)


def _paid_totals(sale: Sale) -> tuple[Decimal, Decimal]:
    paid = sum((payment.amount for payment in sale.payments), Decimal('0.00'))
    paid = _money(paid)
    return paid, _money(sale.total - paid)


def _status_for(sale: Sale, paid: Decimal) -> str:
    if sale.status == 'cancelled':
        return 'cancelled'
    if paid >= sale.total:
        return 'paid'
    if paid > 0:
        return 'partial'
    return 'pending'


def _serialize(sale: Sale) -> dict:
    paid, balance = _paid_totals(sale)
    return {
        'id': sale.id,
        'sale_number': sale.sale_number,
        'customer': (
            {'id': sale.customer.id, 'name': sale.customer.name} if sale.customer else None
        ),
        'seller': {'id': sale.seller.id, 'name': sale.seller.full_name} if sale.seller else None,
        'issued_at': sale.sold_at,
        'status': sale.status,
        'items': [
            {
                'product_id': item.product_id,
                'sku': item.product.sku if item.product else '',
                'name': item.product.name if item.product else '',
                'quantity': item.quantity,
                'unit_price': float(item.unit_price),
                'discount': float(item.discount),
                'subtotal': float(item.subtotal),
            }
            for item in sale.items
        ],
        'subtotal': float(sale.subtotal),
        'discount': float(sale.discount),
        'tax': float(sale.tax),
        'total': float(sale.total),
        'paid': float(paid),
        'balance': float(balance),
        'cancelled_at': sale.cancelled_at,
        'cancel_reason': sale.cancel_reason,
        'received_at': sale.received_at,
        'payments': [
            {
                'id': payment.id,
                'method': payment.method,
                'amount': float(payment.amount),
                'paid_at': payment.paid_at,
                'reference': payment.reference,
            }
            for payment in sale.payments
        ],
        'claims': [
            {
                'id': claim.id,
                'description': claim.description,
                'status': claim.status,
                'created_at': claim.created_at,
                'resolved_at': claim.resolved_at,
            }
            for claim in sale.claims
        ],
    }


def list_sales(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    customer_id: Optional[int] = None,
    seller_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Sale).where(Sale.company_id == company_id)

    if status:
        statement = statement.where(Sale.status == status)
    if customer_id:
        statement = statement.where(Sale.customer_id == customer_id)
    if seller_id:
        statement = statement.where(Sale.seller_id == seller_id)
    if date_from:
        statement = statement.where(Sale.sold_at >= date_from)
    if date_to:
        statement = statement.where(Sale.sold_at <= date_to)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(Sale.sale_number.ilike(term), Sale.notes.ilike(term))
        )

    sales = (
        db.execute(statement.order_by(Sale.sold_at.desc()).limit(5000)).scalars().all()
    )
    payload = [_serialize(sale) for sale in sales]
    if q:
        term = q.strip().lower()
        payload = [
            sale
            for sale in payload
            if term in sale['sale_number'].lower()
            or (sale['customer'] and term in sale['customer']['name'].lower())
            or (sale['seller'] and term in sale['seller']['name'].lower())
        ]
    return paginate(payload, page, page_size)


def get_sale(db: Session, company_id: int, sale_id: int) -> dict:
    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    return _serialize(sale)


def _next_sale_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count(Sale.id)).where(
            Sale.company_id == company_id, Sale.sale_number.like(f'V-{year}-%')
        )
    ).scalar_one()
    return f'V-{year}-{count + 1:06d}'


def create_sale(
    db: Session,
    company_id: int,
    payload: SaleCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    # --- RN-07: vendedor activo -------------------------------------------
    seller = db.execute(
        select(Employee).where(Employee.id == payload.seller_id, Employee.company_id == company_id)
    ).scalar_one_or_none()
    if seller is None:
        raise NotFound('Vendedor no encontrado.')
    if not seller.is_active:
        raise BusinessRuleError('El vendedor debe estar activo para operar ventas (RN-07).')

    customer = db.execute(
        select(Customer).where(Customer.id == payload.customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')

    # --- RN-10: validar stock antes de escribir ---------------------------
    for item in payload.items:
        product = db.execute(
            select(Product).where(Product.id == item.product_id, Product.company_id == company_id)
        ).scalar_one_or_none()
        if product is None:
            raise NotFound(f'Producto {item.product_id} no encontrado.')
        if not product.is_active:
            raise BusinessRuleError(f'El producto {product.name} no está activo (RN-04).')
        stock = db.execute(
            select(Inventory).where(Inventory.product_id == product.id)
        ).scalar_one_or_none()
        available = stock.stock if stock else 0
        if item.quantity > available:
            raise BusinessRuleError(
                f'Stock insuficiente de {product.name} (disponible: {available}).'
            )
        # RN-13: el descuento por línea no supera su subtotal.
        if Decimal(str(item.discount)) > Decimal(str(item.quantity)) * Decimal(str(item.unit_price)):
            raise BusinessRuleError('El descuento de la línea supera su subtotal (RN-13).')

    # --- RN-11: totales siempre calculados en el servidor -----------------
    subtotal = _money(
        sum(Decimal(str(item.quantity)) * Decimal(str(item.unit_price)) for item in payload.items)
    )
    discount = _money(sum(Decimal(str(item.discount)) for item in payload.items))
    tax_rate = Decimal(str(payload.tax_rate))
    tax = _money((subtotal - discount) * tax_rate)
    total = _money(subtotal - discount + tax)

    if payload.payment and Decimal(str(payload.payment.amount)) > total:
        raise BusinessRuleError('El pago no puede superar el total de la venta (RN-16).')

    # --- RN-12: numeración correlativa e inmutable ------------------------
    sale = Sale(
        company_id=company_id,
        customer_id=customer.id,
        seller_id=seller.id,
        sale_number=_next_sale_number(db, company_id),
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        total=total,
        status='pending',
        notes=payload.notes,
    )
    db.add(sale)
    db.flush()

    trace = [
        {
            'module': 'ventas',
            'label': 'Venta registrada',
            'detail': (
                f'{len(payload.items)} línea(s) · total S/ {total} '
                f'(IGV {round(float(tax_rate) * 100)}%) · estado pendiente de cierre'
            ),
        }
    ]

    stock_steps = []
    for item in payload.items:
        product = db.get(Product, item.product_id)
        stock = db.execute(
            select(Inventory).where(Inventory.product_id == product.id)
        ).scalar_one_or_none()
        before = stock.stock if stock else 0

        line_discount = _money(item.discount)
        line_subtotal = _money(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price)) - line_discount
        )
        db.add(
            SaleDetail(
                sale_id=sale.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=_money(item.unit_price),
                discount=line_discount,
                subtotal=line_subtotal,
            )
        )

        if stock is None:
            stock = Inventory(product_id=product.id, stock=0, min_stock=product.min_stock)
            db.add(stock)
            db.flush()
        next_stock = before - item.quantity
        if next_stock < 0:  # RN-20
            raise BusinessRuleError(
                f'Stock insuficiente de {product.name} (disponible: {before}).'
            )
        stock.stock = next_stock

        db.add(
            InventoryMovement(
                product_id=product.id,
                movement_type='out',
                quantity=item.quantity,
                reason=f'Venta {sale.sale_number}',
                resulting_stock=next_stock,
                reference_id=sale.id,
                created_by=actor.id if actor else None,
            )
        )
        stock_steps.append(
            {
                'module': 'inventario',
                'label': f'{product.name} ({product.sku})',
                'detail': f'stock {before} → {next_stock} {product.unit} · kardex OUT registrado',
            }
        )
    trace.extend(stock_steps)

    # --- Pago inicial (RF-07) --------------------------------------------
    paid = Decimal('0.00')
    if payload.payment is not None and payload.payment.amount > 0:
        paid = _money(payload.payment.amount)
        db.add(
            Payment(
                sale_id=sale.id,
                method=payload.payment.method,
                amount=paid,
                reference=payload.payment.reference,
            )
        )
    sale.status = _status_for(sale, paid)

    # --- Historial del cliente (RF-07) ------------------------------------
    count_rows = db.execute(
        select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.company_id == company_id,
            Sale.customer_id == customer.id,
            Sale.status != 'cancelled',
        )
    ).one()
    trace.append(
        {
            'module': 'clientes',
            'label': 'Historial del cliente',
            'detail': (
                f'{customer.name}: {count_rows[0]} compra(s) · '
                f'acumulado S/ {float(count_rows[1] or 0):.2f}'
            ),
        }
    )
    trace.append(
        {
            'module': 'analítica',
            'label': 'Indicadores recalculados',
            'detail': 'Dashboard, Analytics, Insights y Reportes ya reflejan esta venta',
        }
    )

    write_audit(
        db,
        user=actor,
        action='sale.create',
        entity='sales',
        entity_id=sale.id,
        detail={'sale_number': sale.sale_number, 'total': float(total)},
        ip_address=ip,
    )
    db.commit()
    db.refresh(sale)

    paid, balance = _paid_totals(sale)
    return {
        'id': sale.id,
        'sale_number': sale.sale_number,
        'subtotal': float(sale.subtotal),
        'discount': float(sale.discount),
        'tax': float(sale.tax),
        'total': float(sale.total),
        'status': sale.status,
        'inventory_updated': True,
        'paid': float(paid),
        'balance': float(balance),
        'trace': trace,
    }


def cancel_sale(
    db: Session,
    company_id: int,
    sale_id: int,
    reason: str,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """RN-14/RN-15/RN-18: anula, devuelve el stock exacto y exige motivo ≥ 10."""
    if len(reason.strip()) < 10:
        raise ValidationAppError('El motivo de anulación debe tener al menos 10 caracteres (RN-18).')

    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    if sale.status == 'cancelled':
        raise BusinessRuleError('La venta ya está anulada.')

    for item in sale.items:
        stock = db.execute(
            select(Inventory).where(Inventory.product_id == item.product_id)
        ).scalar_one_or_none()
        product = db.get(Product, item.product_id)
        if stock is None:
            stock = Inventory(product_id=item.product_id, stock=0)
            db.add(stock)
            db.flush()
        before = stock.stock
        stock.stock = before + item.quantity
        db.add(
            InventoryMovement(
                product_id=item.product_id,
                movement_type='in',
                quantity=item.quantity,
                reason=f'Anulación {sale.sale_number}: {reason.strip()}',
                resulting_stock=stock.stock,
                reference_id=sale.id,
                created_by=actor.id if actor else None,
            )
        )

    sale.status = 'cancelled'
    sale.cancelled_at = datetime.now(timezone.utc)
    sale.cancel_reason = reason.strip()

    write_audit(
        db,
        user=actor,
        action='sale.cancel',
        entity='sales',
        entity_id=sale.id,
        detail={'sale_number': sale.sale_number, 'reason': reason.strip()},
        ip_address=ip,
    )
    db.commit()
    db.refresh(sale)
    return _serialize(sale)


def add_payment(
    db: Session,
    company_id: int,
    sale_id: int,
    payload: PaymentCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    if sale.status == 'cancelled':
        raise BusinessRuleError('No se pueden registrar pagos sobre una venta anulada.')

    paid, balance = _paid_totals(sale)
    amount = _money(payload.amount)
    if amount > balance:
        raise BusinessRuleError(
            f'El pago excede el saldo pendiente (saldo: S/ {balance}) — RN-16.'
        )

    db.add(
        Payment(sale=sale, method=payload.method, amount=amount, reference=payload.reference)
    )
    db.flush()
    paid, balance = _paid_totals(sale)
    sale.status = _status_for(sale, paid)

    write_audit(
        db,
        user=actor,
        action='sale.payment',
        entity='payments',
        entity_id=sale.id,
        detail={'amount': float(amount), 'method': payload.method},
        ip_address=ip,
    )
    db.commit()
    db.refresh(sale)
    return _serialize(sale)


def update_sale_status(
    db: Session,
    company_id: int,
    sale_id: int,
    status_value: str,
    reason: Optional[str] = None,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """PUT /sales/{id}/status — cambio manual de estado (Admin/Gerente).

    `cancelled` exige motivo (RN-18) y devuelve el stock (RN-15); los demás
    estados se fijan manualmente sin tocar importes (RN-17).
    """
    if status_value not in ('pending', 'partial', 'paid', 'cancelled'):
        raise ValidationAppError('Estado no válido: use pending, partial, paid o cancelled.')

    if status_value == 'cancelled':
        if not reason:
            raise ValidationAppError('La anulación requiere un motivo (RN-18).')
        return cancel_sale(db, company_id, sale_id, reason, actor=actor, ip=ip)

    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    if sale.status == 'cancelled':
        raise BusinessRuleError('No se puede cambiar el estado de una venta anulada.')

    sale.status = status_value
    write_audit(
        db,
        user=actor,
        action='sale.status',
        entity='sales',
        entity_id=sale.id,
        detail={'status': status_value},
        ip_address=ip,
    )
    db.commit()
    db.refresh(sale)
    return _serialize(sale)


def set_sale_received(
    db: Session,
    company_id: int,
    sale_id: int,
    received: bool,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """PUT /sales/{id}/received — entrega del pedido (lo ve el cliente en la tienda)."""
    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    if sale.status == 'cancelled':
        raise BusinessRuleError('No se puede marcar como recibida una venta anulada.')

    sale.received_at = datetime.now(timezone.utc) if received else None
    write_audit(
        db,
        user=actor,
        action='sale.receive' if received else 'sale.unreceive',
        entity='sales',
        entity_id=sale.id,
        detail={'received': received},
        ip_address=ip,
    )
    db.commit()
    db.refresh(sale)
    return _serialize(sale)
