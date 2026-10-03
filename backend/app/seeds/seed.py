"""Seed de datos de demostración (idempotente).

Genera una empresa con sus roles, usuarios (uno por rol), vendedores,
catálogo de productos, clientes y ~50 ventas repartidas en los últimos
12 meses, con pagos y kardex consistente (stock final = stock actual).

También siembra las extensiones de la migración 0002 (sucursales,
proveedores, cotizaciones, almacenes, seguridad y analítica):
`seed_extensions` es idempotente y también se puede ejecutar solo.

Uso:
    python -m app.seeds.seed            # si la base está vacía (demo completa)
    python -m app.seeds.seed --login     # solo empresa + roles + admin
    python -m app.seeds.seed --extend   # solo las tablas de la 0002
    python -m app.seeds.seed --force     # limpia y vuelve a sembrar
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.analytics_extra import AutomationRule, DataExport, KpiSnapshot, ScheduledReport
from app.models.branch import Branch
from app.models.category import Category
from app.models.company import Company
from app.models.crm import CustomerInteraction, CustomerSegment
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.payment import Payment
from app.models.pricing import PriceList, PriceListItem, ProductPromotion, Promotion, Unit
from app.models.product import Product
from app.models.purchase import PurchaseOrder, PurchaseOrderDetail
from app.models.quote import Quote, QuoteDetail
from app.models.role import Role
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.sales_return import SalesReturn, SalesReturnDetail
from app.models.security import LoginAttempt, PasswordReset, Permission, RefreshToken, RolePermission
from app.models.supplier import Supplier
from app.models.system import AppEvent, Notification, SystemSetting
from app.models.user import User
from app.models.warehouse import Shipment, StockCount, StockCountDetail, Warehouse, WarehouseStock

TWO = Decimal('0.01')
TAX_RATE = Decimal('0.18')

ROLES = [
    ('admin', 'Administrador', {'usuarios': 'CRUD', 'clientes': 'CRUD', 'productos': 'CRUD',
                                'vendedores': 'CRUD', 'ventas': 'CRUD', 'inventario': 'CRUD',
                                'analitica': 'R', 'reportes': 'CRUD', 'auditoria': 'R'}),
    ('gerente', 'Gerente', {'clientes': 'CRUD', 'productos': 'CRUD', 'vendedores': 'R',
                            'ventas': 'CRUD', 'inventario': 'R', 'analitica': 'R',
                            'reportes': 'CRUD', 'auditoria': 'R'}),
    ('vendedor', 'Vendedor', {'clientes': 'CRU', 'productos': 'R', 'ventas': 'CRU',
                              'inventario': 'R', 'analitica': 'R', 'reportes': 'R'}),
    ('analista', 'Analista', {'clientes': 'R', 'productos': 'R', 'vendedores': 'R',
                              'ventas': 'R', 'inventario': 'R', 'analitica': 'CRUD',
                              'reportes': 'CRUD'}),
    ('almacen', 'Almacén', {'productos': 'R', 'ventas': 'R', 'inventario': 'CRUD',
                            'reportes': 'R'}),
]

USERS = [
    ('admin@salesia.com', 'Administrador del Sistema', 'admin'),
    ('gerente@salesia.com', 'María Fernanda López', 'gerente'),
    ('vendedor@salesia.com', 'Luis Ríos', 'vendedor'),
    ('analista@salesia.com', 'Diego Ramírez', 'analista'),
    ('almacen@salesia.com', 'Rosa Huamán', 'almacen'),
]
DEMO_PASSWORD = 'admin123'

EMPLOYEES = [
    ('Luis Ríos', '41236587', 'Vendedor', '+51987111222', 'luis.rios@salesia.pe', '2025-08-01'),
    ('Carlos Peña', '45871236', 'Vendedor', '+51987333444', 'carlos.pena@salesia.pe', '2025-09-15'),
    ('Ana Torres', '47851236', 'Vendedor', '+51987555666', 'ana.torres@salesia.pe', '2025-06-01'),
]

CATEGORIES = [
    'Bebidas', 'Abarrotes', 'Panadería', 'Frutas y Verduras',
    'Limpieza', 'Snacks', 'Lácteos', 'Cuidado personal',
]

# (sku, nombre, categoría índice, costo, precio, stock_mínimo, stock_actual, activo)
PRODUCTS = [
    ('SKU-0001', 'Gaseosa 500ml', 1, 3.5, 5.0, 24, 96, True),
    ('SKU-0002', 'Agua mineral 1L', 1, 2.0, 3.0, 36, 120, True),
    ('SKU-0003', 'Jugo de naranja 1L', 1, 4.5, 6.5, 24, 18, True),
    ('SKU-0004', 'Café molido 250g', 2, 12.0, 18.5, 12, 45, True),
    ('SKU-0005', 'Azúcar 1kg', 2, 3.2, 4.8, 30, 80, True),
    ('SKU-0006', 'Arroz premium 1kg', 2, 4.1, 5.9, 30, 22, True),
    ('SKU-0007', 'Aceite vegetal 1L', 2, 6.5, 9.2, 18, 40, True),
    ('SKU-0008', 'Pan de molde', 3, 2.8, 4.0, 20, 35, True),
    ('SKU-0009', 'Croissant', 3, 1.5, 2.5, 24, 12, True),
    ('SKU-0010', 'Manzana roja 1kg', 4, 3.0, 4.5, 15, 50, True),
    ('SKU-0011', 'Plátano 1kg', 4, 2.2, 3.2, 20, 0, True),
    ('SKU-0012', 'Detergente 1kg', 5, 8.0, 12.5, 12, 30, True),
    ('SKU-0013', 'Jabón de tocador x3', 5, 4.5, 6.8, 18, 25, True),
    ('SKU-0014', 'Papas fritas 100g', 6, 2.5, 3.8, 30, 60, True),
    ('SKU-0015', 'Chocolate 100g', 6, 3.8, 5.5, 24, 40, True),
    ('SKU-0016', 'Leche entera 1L', 7, 3.6, 4.9, 36, 70, True),
    ('SKU-0017', 'Queso fresco 500g', 7, 9.0, 13.5, 10, 8, True),
    ('SKU-0018', 'Shampoo 400ml', 8, 11.0, 16.9, 12, 28, True),
    ('SKU-0019', 'Pasta dental', 8, 5.5, 8.2, 15, 33, True),
    ('SKU-0020', 'Gaseosa cola 2L', 1, 5.5, 8.0, 20, 55, False),
]

# (tipo_doc, documento, nombre, email, teléfono, dirección, segmento, activo)
CUSTOMERS = [
    ('DNI', '74125896', 'María Quispe', 'maria.quispe@correo.com', '+51987654321', 'Av. Los Olivos 123, Lima', 'Recurrente', True),
    ('DNI', '45812369', 'Jorge Ramírez', 'jorge.ramirez@correo.com', '+51912345678', 'Jr. Cusco 450, Wanchaq, Cusco', 'Frecuente', True),
    ('RUC', '20512345678', 'Comercial Andina S.A.C.', 'compras@comercialandina.pe', '+51988112233', 'Av. Argentina 2890, Callao', 'Frecuente', True),
    ('DNI', '60238741', 'Lucía Fernández', 'lucia.fernandez@correo.com', '+51999887766', 'Calle Los Pinos 222, San Isidro', 'Nuevo', True),
    ('DNI', '72341589', 'Carlos Ttito', 'carlos.ttito@correo.com', '+51955443322', 'Av. Del Sol 412, Cusco', 'Recurrente', True),
    ('DNI', '41902365', 'Ana Torres', 'ana.torres.cliente@correo.com', '+51966778899', 'Jr. Bolognesi 118, Arequipa', 'Recurrente', True),
    ('DNI', '75612348', 'Luis Fernández', 'luis.fernandez@correo.com', '+51933221144', 'Av. Túpac Amaru 3050, Lima', 'Ocasional', True),
    ('DNI', '48756123', 'Carmen Vega', 'carmen.vega@correo.com', '+51977665544', 'Calle Tacna 234, Juliaca', 'Recurrente', True),
    ('DNI', '70125634', 'Pedro Salazar', 'pedro.salazar@correo.com', '+51911223344', 'Av. Brasil 1450, Jesús María', 'Nuevo', True),
    ('RUC', '20601234567', 'Distribuidora Sur E.I.R.L.', 'contacto@distrisur.pe', '+51988445566', 'Av. Ejército 780, Arequipa', 'Frecuente', True),
    ('DNI', '61234598', 'Rosa Huamán', 'rosa.huaman@correo.com', '+51944556677', 'Jr. Huánuco 302, Huancayo', 'Recurrente', True),
    ('DNI', '73456128', 'Miguel Castro', 'miguel.castro@correo.com', '+51955332211', 'Av. Pardo 501, Miraflores', 'Ocasional', True),
    ('DNI', '47856231', 'Fernanda Rojas', 'fernanda.rojas@correo.com', '+51966887755', 'Calle Independencia 89, Trujillo', 'Recurrente', True),
    ('DNI', '75012369', 'Diego Mendoza', 'diego.mendoza@correo.com', '+51977223344', 'Av. San Martín 1220, Trujillo', 'Nuevo', True),
    ('CE', '00124587', 'Valeria Cruz', 'valeria.cruz@correo.com', '+51988990011', 'Av. La Marina 2100, Lima', 'Ocasional', True),
    ('DNI', '43658712', 'José Ninahuanca', 'jose.ninahuanca@correo.com', '+51911556677', 'Jr. Camaná 455, Cercado, Lima', 'Recurrente', True),
    ('DNI', '76540123', 'Gabriela Paredes', 'gabriela.paredes@correo.com', '+51933778899', 'Av. Petit Thouars 5400, Lima', 'Nuevo', True),
    ('DNI', '40125638', 'Roberto Chávez', 'roberto.chavez@correo.com', '+51966112233', 'Av. Piérola 310, Ica', 'Recurrente', True),
    ('DNI', '75863214', 'Sofía Aguilar', 'sofia.aguilar@correo.com', '+51944889900', 'Calle Schell 456, Chiclayo', 'Ocasional', False),
    ('DNI', '48236519', 'Marco Villanueva', 'marco.villanueva@correo.com', '+51955998877', 'Av. Grau 780, Piura', 'Recurrente', True),
    ('DNI', '74568912', 'Patricia León', 'patricia.leon@correo.com', '+51977445566', 'Jr. Ancash 320, Cercado, Lima', 'Recurrente', True),
    ('DNI', '62345789', 'Andrés Aguayo', 'andres.aguayo@correo.com', '+51911667788', 'Av. Universitaria 1200, Lima', 'Nuevo', True),
    ('DNI', '45678123', 'Elena Quispe', 'elena.quispe@correo.com', '+51966223344', 'Av. El Sol 945, Cusco', 'Ocasional', False),
    ('DNI', '73985412', 'Ricardo Soto', 'ricardo.soto@correo.com', '+51988556677', 'Av. Argentina 1250, Callao', 'Recurrente', False),
]

CUSTOMER_CREATED = [
    '2026-03-14T10:05:00Z', '2025-11-02T15:40:00Z', '2025-09-18T09:15:00Z', '2026-06-21T12:00:00Z',
    '2026-01-09T17:25:00Z', '2025-12-30T11:45:00Z', '2026-04-03T08:30:00Z', '2026-02-14T14:20:00Z',
    '2026-07-12T10:10:00Z', '2025-10-05T16:00:00Z', '2026-03-27T13:35:00Z', '2026-05-16T09:50:00Z',
    '2026-01-25T15:05:00Z', '2026-08-02T11:15:00Z', '2026-06-08T18:40:00Z', '2025-12-11T10:30:00Z',
    '2026-08-21T14:55:00Z', '2026-02-02T12:25:00Z', '2025-11-27T16:10:00Z', '2026-04-19T09:05:00Z',
    '2026-05-30T17:45:00Z', '2026-09-01T08:20:00Z', '2025-10-14T13:00:00Z', '2026-01-17T11:30:00Z',
]


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(TWO, rounding=ROUND_HALF_UP)


def compute_totals(lines: List[dict]) -> Dict[str, Decimal]:
    subtotal = money(sum(Decimal(str(line['quantity'])) * line['unit_price'] for line in lines))
    discount = money(sum(line['discount'] for line in lines))
    tax = money((subtotal - discount) * TAX_RATE)
    return {'subtotal': subtotal, 'discount': discount, 'tax': tax,
            'total': money(subtotal - discount + tax)}


def _iso(value: str) -> datetime:
    return datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)


def build_sales(rng: random.Random, products: List[Product], customers: List[Customer],
                employees: List[Employee]) -> List[dict]:
    """Ventas determinísticas de los últimos 12 meses con su estado y pago."""
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=365)).replace(day=1)
    specs: List[dict] = []

    for index in range(50):
        day = window_start + timedelta(
            days=rng.randint(0, max((now - window_start).days, 1)),
            hours=rng.randint(9, 19), minutes=rng.randint(0, 59),
        )
        if day > now:
            day = now - timedelta(days=rng.randint(0, 10), hours=rng.randint(1, 8))

        if index % 13 == 0:
            status = 'cancelled'
        elif index % 9 == 0:
            status = 'pending'
        elif index % 7 == 0:
            status = 'partial'
        else:
            status = 'paid'

        line_count = rng.randint(1, 3)
        chosen = rng.sample(products, line_count)
        lines = []
        for product in chosen:
            quantity = rng.randint(1, 6)
            line_value = money(Decimal(str(quantity)) * money(product.price))
            # El descuento nunca supera el valor de la línea (RN-13).
            discount = money(min(rng.choice([0, 0, 0, 1, 2, 5]), line_value))
            lines.append({'product': product, 'quantity': quantity,
                          'unit_price': money(product.price), 'discount': discount})

        totals = compute_totals(lines)
        ratio = {'paid': Decimal('1'), 'partial': Decimal(str(rng.choice(['0.4', '0.5', '0.6']))),
                 'pending': Decimal('0'), 'cancelled': Decimal('0')}[status]

        specs.append({
            'sold_at': day,
            'status': status,
            'lines': lines,
            'totals': totals,
            'paid': money(totals['total'] * ratio),
            'customer': rng.choice(customers),
            'seller': rng.choice(employees),
            'method': rng.choice(['cash', 'card', 'transfer']),
            'notes': None,
        })

    specs.sort(key=lambda spec: spec['sold_at'])
    return specs


def seed_extensions(db: Session) -> None:
    """Siembra las 32 tablas de la migración 0002 (idempotente)."""
    if db.execute(select(Branch.id)).scalars().first():
        print('Extensiones 0002 ya sembradas; nada que hacer.')
        return

    company = db.execute(select(Company)).scalars().first()
    if company is None:
        print('No hay empresa; ejecuta el seed base primero.')
        return

    roles = {role.name: role for role in db.execute(select(Role)).scalars()}
    users = db.execute(select(User)).scalars().all()
    admin = users[0]
    products = db.execute(select(Product).order_by(Product.id)).scalars().all()
    active_products = [product for product in products if product.is_active]
    customers = db.execute(select(Customer).order_by(Customer.id)).scalars().all()
    sales = db.execute(
        select(Sale).where(Sale.status != 'cancelled').order_by(Sale.id)
    ).scalars().all()
    now = datetime.now(timezone.utc)

    # --- Operación: sucursales, proveedores, compras, cotizaciones, devoluciones ---
    branches = [
        Branch(company_id=company.id, name='Lima Centro', code='LIM',
               address='Av. República de Panamá 3591, San Isidro', is_active=True),
        Branch(company_id=company.id, name='Arequipa', code='ARE',
               address='Av. Ejército 780, Yanahuara', is_active=True),
    ]
    db.add_all(branches)

    suppliers = [
        Supplier(company_id=company.id, ruc='20456789012', name='Distribuidora Andina S.A.C.',
                 email='ventas@andina.pe', phone='+5116102040',
                 address='Av. Argentina 2890, Callao', is_active=True),
        Supplier(company_id=company.id, ruc='20567890123', name='Insumos del Sur E.I.R.L.',
                 email='contacto@insumossur.pe', phone='+5154234567',
                 address='Av. Ejército 410, Arequipa', is_active=True),
        Supplier(company_id=company.id, ruc='20678901234', name='Importadora Pacífico S.A.',
                 email='pedidos@pacificoimp.pe', phone='+5117203040',
                 address='Jr. Camaná 455, Cercado, Lima', is_active=True),
    ]
    db.add_all(suppliers)
    db.flush()

    purchase_orders = []
    for index, supplier in enumerate(suppliers[:2]):
        order = PurchaseOrder(
            company_id=company.id, supplier_id=supplier.id, created_by=admin.id,
            order_number=f'OC-2026-{index + 1:04d}',
            status='received' if index == 0 else 'pending',
            notes='Orden de compra de demostración',
        )
        db.add(order)
        db.flush()
        subtotal = Decimal('0')
        for product in active_products[index * 3:index * 3 + 3]:
            quantity = 10 + index
            unit_cost = money(product.cost_price)
            line = money(quantity * unit_cost)
            subtotal += line
            db.add(PurchaseOrderDetail(purchase_order_id=order.id, product_id=product.id,
                                       quantity=quantity, unit_cost=unit_cost, subtotal=line))
        purchase_orders.append(order)
        order.total = money(subtotal)

    quotes = []
    quote_status = ['sent', 'accepted', 'draft']
    for index, customer in enumerate(customers[:3]):
        quote = Quote(
            company_id=company.id, customer_id=customer.id, created_by=admin.id,
            quote_number=f'COT-2026-{index + 1:04d}', status=quote_status[index],
            valid_until=now + timedelta(days=15 - index * 5),
            notes='Cotización de demostración',
        )
        db.add(quote)
        db.flush()
        lines = []
        for product in active_products[index * 2:index * 2 + 2]:
            quantity = 5 + index
            line_discount = money(0)
            lines.append({'quantity': quantity, 'unit_price': money(product.price),
                          'discount': line_discount})
            db.add(QuoteDetail(quote_id=quote.id, product_id=product.id,
                               quantity=quantity, unit_price=money(product.price),
                               discount=line_discount,
                               subtotal=money(quantity * money(product.price))))
        totals = compute_totals(lines)
        quote.subtotal, quote.discount = totals['subtotal'], totals['discount']
        quote.tax, quote.total = totals['tax'], totals['total']
        quotes.append(quote)

    returned = SalesReturn(
        company_id=company.id, sale_id=sales[0].id, created_by=admin.id,
        return_number='NC-2026-0001', status='completed',
        reason='Producto con defecto de empaque (demo)',
    )
    db.add(returned)
    db.flush()
    first_line = db.execute(
        select(SaleDetail).where(SaleDetail.sale_id == sales[0].id).limit(1)
    ).scalars().first()
    return_qty = 1
    return_amount = money(first_line.unit_price * return_qty)
    db.add(SalesReturnDetail(return_id=returned.id, product_id=first_line.product_id,
                             quantity=return_qty, unit_price=first_line.unit_price,
                             subtotal=return_amount))
    returned.total = return_amount

    # --- Precios: unidades, listas, promociones ---
    units = [
        Unit(company_id=company.id, name='Unidad', symbol='UND', is_active=True),
        Unit(company_id=company.id, name='Kilo', symbol='KG', is_active=True),
        Unit(company_id=company.id, name='Litro', symbol='LT', is_active=True),
        Unit(company_id=company.id, name='Caja', symbol='CJ', is_active=True),
    ]
    db.add_all(units)
    db.flush()

    price_list = PriceList(company_id=company.id, name='Lista mayorista 2026',
                           currency='PEN', is_active=True)
    db.add(price_list)
    db.flush()
    for product in active_products[:6]:
        db.add(PriceListItem(price_list_id=price_list.id, product_id=product.id,
                             price=money(product.price * Decimal('0.9'))))

    promotions = [
        Promotion(company_id=company.id, name='Semana de bebidas', kind='percent',
                  value=Decimal('10'), starts_at=now - timedelta(days=14),
                  ends_at=now + timedelta(days=14), is_active=True),
        Promotion(company_id=company.id, name='Descuento de caja', kind='fixed',
                  value=Decimal('5'), starts_at=now - timedelta(days=7),
                  ends_at=now + timedelta(days=30), is_active=True),
    ]
    db.add_all(promotions)
    db.flush()
    for product in active_products[:4]:
        db.add(ProductPromotion(product_id=product.id, promotion_id=promotions[0].id))
    for product in active_products[4:6]:
        db.add(ProductPromotion(product_id=product.id, promotion_id=promotions[1].id))

    # --- CRM: segmentos e interacciones ---
    segments = [
        CustomerSegment(company_id=company.id, name='Frecuentes',
                        description='Más de 5 compras en el año', min_purchases=5,
                        min_total=Decimal('500'), is_active=True),
        CustomerSegment(company_id=company.id, name='Recurrentes',
                        description='De 2 a 4 compras en el año', min_purchases=2,
                        min_total=Decimal('150'), is_active=True),
        CustomerSegment(company_id=company.id, name='Nuevos',
                        description='Primera compra en el último mes', min_purchases=1,
                        min_total=Decimal('0'), is_active=True),
    ]
    db.add_all(segments)

    interactions = [
        ('call', 'Llamada de seguimiento', 'Llamada de seguimiento post-venta'),
        ('email', 'Catálogo actualizado', 'Envío de catálogo actualizado'),
        ('visit', 'Visita comercial', 'Visita comercial trimestral'),
        ('note', 'Facturación', 'Solicita factura electrónica'),
    ]
    for index, (kind, subject, notes) in enumerate(interactions):
        db.add(CustomerInteraction(
            company_id=company.id, customer_id=customers[index % len(customers)].id,
            performed_by=admin.id, kind=kind, subject=subject, notes=notes,
            occurred_at=now - timedelta(days=15 - index * 3),
        ))

    # --- Almacenes: bodegas, stock, conteos, envíos ---
    warehouses = [
        Warehouse(company_id=company.id, name='Almacén central', code='ALM-CEN',
                  address='Av. República de Panamá 3591, San Isidro', is_active=True),
        Warehouse(company_id=company.id, name='Almacén sur', code='ALM-SUR',
                  address='Av. Ejército 410, Yanahuara, Arequipa', is_active=True),
    ]
    db.add_all(warehouses)
    db.flush()
    for product in active_products[:8]:
        db.add(WarehouseStock(warehouse_id=warehouses[0].id, product_id=product.id,
                              stock=product.min_stock * 2, min_stock=product.min_stock))
    for product in active_products[8:12]:
        db.add(WarehouseStock(warehouse_id=warehouses[1].id, product_id=product.id,
                              stock=product.min_stock, min_stock=product.min_stock))

    stock_count = StockCount(company_id=company.id, warehouse_id=warehouses[0].id,
                             count_number='CC-2026-0001', status='done',
                             counted_by=admin.id, notes='Conteo cíclico demo')
    db.add(stock_count)
    db.flush()
    for index, product in enumerate(active_products[:3]):
        expected = product.min_stock * 2
        counted = expected - (2 if index == 1 else 0)
        db.add(StockCountDetail(stock_count_id=stock_count.id, product_id=product.id,
                                expected_qty=expected, counted_qty=counted,
                                difference=counted - expected))

    for index, sale in enumerate(sales[:2]):
        db.add(Shipment(company_id=company.id, sale_id=sale.id,
                        tracking_code=f'TRK-{2026}{index + 1:06d}',
                        carrier='Shalom' if index == 0 else 'Olva',
                        status='delivered' if index == 0 else 'in_transit',
                        shipped_at=sale.sold_at + timedelta(days=1)))

    # --- Seguridad: permisos, intentos, tokens ---
    modules = sorted({module for _, _, perms in ROLES for module in perms})
    permission_by_module: Dict[str, Permission] = {}
    for module in modules:
        permission = Permission(code=f'module.{module}',
                                name=f'Módulo {module.capitalize()}',
                                description=f'Acceso al módulo {module}')
        db.add(permission)
        permission_by_module[module] = permission
    db.flush()
    for role_key, _, perms in ROLES:
        for module in perms:
            db.add(RolePermission(role_id=roles[role_key].id,
                                  permission_id=permission_by_module[module].id, granted=True))

    for index, (email, success) in enumerate([
        ('admin@salesia.com', True), ('admin@salesia.com', False),
        ('gerente@salesia.com', True), ('hacker@ejemplo.com', False),
    ]):
        db.add(LoginAttempt(user_id=admin.id if success else None,
                            email=email, success=success,
                            ip=f'192.168.1.{10 + index}',
                            attempted_at=now - timedelta(hours=6 - index)))

    for index, user in enumerate(users[:2]):
        db.add(RefreshToken(user_id=user.id, token_hash=f'demo-token-hash-{index + 1}',
                            expires_at=now + timedelta(days=7), revoked_at=None))

    db.add(PasswordReset(user_id=admin.id, token_hash='demo-reset-hash-1',
                         expires_at=now + timedelta(hours=1), used_at=None))

    # --- Analítica: KPIs, reportes, exportaciones, reglas ---
    for months_ago in (2, 1, 0):
        period_start = (now.replace(day=1) - timedelta(days=31 * months_ago)).replace(day=1)
        period_end = period_start + timedelta(days=30)
        base = Decimal(str(10000 - months_ago * 1200))
        for kpi_code, factor, suffix in [
            ('ingresos', Decimal('1'), ''),
            ('transacciones', Decimal('0.05'), ''),
            ('ticket_promedio', Decimal('0.12'), ''),
        ]:
            db.add(KpiSnapshot(company_id=company.id, kpi_code=kpi_code, value=money(base * factor),
                               period_start=period_start, period_end=period_end))

    for index, (report_type, fmt) in enumerate([('sales_summary', 'xlsx'),
                                                ('inventory_status', 'csv')]):
        db.add(ScheduledReport(company_id=company.id, title=f'Reporte {report_type}',
                               report_type=report_type, parameters={'format': fmt},
                               frequency='monthly', is_active=True,
                               created_by=admin.id,
                               next_run_at=now + timedelta(days=30 - index * 7)))

    for index, (export_type, fmt, rows) in enumerate([('ventas', 'xlsx', 50),
                                                      ('clientes', 'csv', 24)]):
        db.add(DataExport(company_id=company.id, export_type=export_type, format=fmt,
                          status='done', requested_by=admin.id, row_count=rows))

    automation_rules = [
        ('ALERTA_STOCK', 'Alerta de stock mínimo', 'Aviso cuando un producto baja del stock mínimo',
         'warning', {'operator': '<=', 'source': 'stock_actual'},
         {'type': 'notification', 'title': 'Stock bajo'}),
        ('RN-40_MINIMO_DATOS', 'Mínimo de observaciones', 'Exigir n>=10 antes de concluir la distribución',
         'block', {'operator': '>=', 'source': 'n_observaciones', 'value': 10},
         {'type': 'message', 'code': 'RN-40'}),
        ('REG-01_TENDENCIA', 'Detección de tendencia', 'Marca regímenes crecientes o decrecientes',
         'info', {'operator': '>', 'source': 'pendiente_tendencia', 'value': 0},
         {'type': 'insight', 'kind': 'tendencia'}),
        ('REG-07_STOCK_INSIGHT', 'Insight de cobertura de stock', 'Genera insight si la cobertura es baja',
         'warning', {'operator': '<', 'source': 'cobertura_dias', 'value': 15},
         {'type': 'insight', 'kind': 'stock'}),
        ('RF-21_HISTORIAL', 'Historial de ventas', 'Exigir historial para comparativos',
         'block', {'operator': '>=', 'source': 'ventas_historicas', 'value': 5},
         {'type': 'message', 'code': 'RF-21'}),
        ('RN-10_STOCK_INSUFICIENTE', 'Stock insuficiente en venta', 'Bloquear venta sin stock',
         'block', {'operator': '<', 'source': 'stock_disponible', 'value': 0},
         {'type': 'message', 'code': 'RN-10'}),
    ]
    for index, (code, name, description, severity, condition, action) in enumerate(automation_rules):
        db.add(AutomationRule(company_id=company.id, code=code, name=name,
                              description=description, severity=severity,
                              condition=condition, action=action, is_active=index % 3 != 2))

    notifications = [
        ('Stock bajo', 'Stock bajo en 3 productos', 'warning'),
        ('Reportes', 'Reporte mensual generado', 'success'),
        ('Seguridad', '2 intentos de acceso fallidos', 'danger'),
        ('Sistema', 'Respaldo diario completado', 'info'),
    ]
    for index, (title, message, level) in enumerate(notifications):
        db.add(Notification(company_id=company.id, user_id=admin.id, title=title,
                            level=level, message=message,
                            read_at=now - timedelta(hours=1) if index == 0 else None,
                            created_at=now - timedelta(hours=5 - index)))

    settings = [
        ('tax_rate', {'value': 0.18}),
        ('currency', {'code': 'PEN', 'symbol': 'S/' }),
        ('min_observations', {'value': 10}),
        ('timezone', {'value': 'America/Lima'}),
    ]
    for key, value in settings:
        db.add(SystemSetting(company_id=company.id, key=key, value=value))

    events = [
        ('seed.completed', 'Seed base completado'),
        ('sale.paid', 'Venta pagada de demostración'),
        ('report.exported', 'Exportación de reporte'),
        ('user.login', 'Inicio de sesión demo'),
        ('stock.adjusted', 'Ajuste de stock demo'),
        ('settings.updated', 'Configuración inicial'),
    ]
    for index, (event_type, detail) in enumerate(events):
        db.add(AppEvent(company_id=company.id, event_type=event_type, entity='system',
                        payload={'detail': detail, 'n': index}))

    db.commit()
    print('Extensiones 0002 sembradas: 2 sucursales · 3 proveedores · 2 órdenes de compra · '
          '3 cotizaciones · 1 devolución · 4 unidades · 1 lista de precios · 2 promociones · '
          '3 segmentos · 4 interacciones · 2 almacenes · 1 conteo · 2 envíos · '
          f'{len(modules)} permisos · intentos/tokens · KPIs/reportes/reglas/notificaciones/configuración.')


def seed_login(db: Session) -> None:
    """Deja solo lo mínimo para entrar: 1 empresa, 5 roles y el admin (idempotente)."""
    if db.execute(select(User.id)).scalars().first():
        print('Ya hay usuarios; nada que hacer (usa --force para el seed completo).')
        return

    company = Company(name='SalesIA Enterprise', ruc='20123456789',
                      address='Av. República de Panamá 3591, San Isidro, Lima',
                      phone='+5116102030', email='contacto@salesia.pe')
    db.add(company)
    db.flush()

    admin_role = None
    for key, description, permissions in ROLES:
        role = Role(name=key, description=description, permissions=permissions)
        db.add(role)
        if key == 'admin':
            admin_role = role
    db.flush()

    db.add(User(company_id=company.id, role_id=admin_role.id,
                full_name='Administrador del Sistema',
                email='admin@salesia.com', password_hash=hash_password(DEMO_PASSWORD),
                is_active=True))
    db.commit()
    print('Login listo: 1 empresa · 5 roles · 1 usuario admin.')
    print(f'Acceso: admin@salesia.com / {DEMO_PASSWORD}')


def seed(db: Session, force: bool = False) -> None:
    existing = db.execute(select(User.id)).scalars().first()
    if existing and not force:
        print('La base ya contiene datos; usa --force para volver a sembrar.')
        return

    if force:
        from app.core.database import Base

        bind = db.get_bind()
        Base.metadata.drop_all(bind=bind)
        Base.metadata.create_all(bind=bind)

    rng = random.Random(20261002)

    company = Company(name='SalesIA Enterprise', ruc='20123456789',
                      address='Av. República de Panamá 3591, San Isidro, Lima',
                      phone='+5116102030', email='contacto@salesia.pe')
    db.add(company)
    db.flush()

    roles: Dict[str, Role] = {}
    for key, description, permissions in ROLES:
        role = Role(name=key, description=description, permissions=permissions)
        db.add(role)
        roles[key] = role
    db.flush()

    password_hash = hash_password(DEMO_PASSWORD)
    for email, full_name, role_key in USERS:
        db.add(User(company_id=company.id, role_id=roles[role_key].id, full_name=full_name,
                    email=email, password_hash=password_hash, is_active=True))
    db.flush()

    employees = []
    for full_name, document, position, phone, email, hire_date in EMPLOYEES:
        employee = Employee(company_id=company.id, full_name=full_name, document=document,
                            position=position, phone=phone, email=email,
                            hire_date=datetime.strptime(hire_date, '%Y-%m-%d').date())
        db.add(employee)
        employees.append(employee)
    db.flush()

    categories = []
    for name in CATEGORIES:
        category = Category(company_id=company.id, name=name, description=f'Categoría {name}')
        db.add(category)
        categories.append(category)
    db.flush()

    products: List[Product] = []
    stocks: Dict[int, int] = {}
    for sku, name, category_index, cost, price, min_stock, stock, active in PRODUCTS:
        product = Product(company_id=company.id, sku=sku, name=name,
                          category_id=categories[category_index - 1].id,
                          cost_price=money(cost), price=money(price), min_stock=min_stock,
                          unit='UND', is_active=active)
        db.add(product)
        products.append(product)
        stocks[id(product)] = stock
    db.flush()

    customers: List[Customer] = []
    for index, (doc_type, doc_number, name, email, phone, address, segment, active) in enumerate(CUSTOMERS):
        customer = Customer(company_id=company.id, document_type=doc_type,
                            document_number=doc_number, name=name, email=email, phone=phone,
                            address=address, segment=segment, is_active=active)
        db.add(customer)
        customers.append(customer)
    db.flush()

    sale_specs = build_sales(rng, products, customers, employees)

    # Kardex: stock inicial = stock actual + unidades vendidas (excluye anuladas).
    sold_units: Dict[int, int] = {}
    for spec in sale_specs:
        if spec['status'] == 'cancelled':
            continue
        for line in spec['lines']:
            key = id(line['product'])
            sold_units[key] = sold_units.get(key, 0) + line['quantity']

    remaining: Dict[int, int] = {}
    for product in products:
        key = id(product)
        initial = stocks[key] + sold_units.get(key, 0)
        remaining[key] = initial
        db.add(Inventory(product_id=product.id, stock=stocks[key], min_stock=product.min_stock))
        db.add(InventoryMovement(
            product_id=product.id, movement_type='in', quantity=initial,
            reason='Stock inicial (seed)', resulting_stock=initial, created_by=None,
        ))
    db.flush()

    year_counters: Dict[int, int] = {}
    for spec in sale_specs:
        year = spec['sold_at'].year
        year_counters[year] = year_counters.get(year, 0) + 1
        totals = spec['totals']
        sale = Sale(
            company_id=company.id,
            customer_id=spec['customer'].id,
            seller_id=spec['seller'].id,
            sale_number=f'V-{year}-{year_counters[year]:06d}',
            sold_at=spec['sold_at'],
            subtotal=totals['subtotal'], discount=totals['discount'],
            tax=totals['tax'], total=totals['total'],
            status=spec['status'],
            notes=spec['notes'],
            cancelled_at=spec['sold_at'] if spec['status'] == 'cancelled' else None,
            cancel_reason='Venta anulada en datos de demostración'
            if spec['status'] == 'cancelled' else None,
        )
        db.add(sale)
        db.flush()

        for line in spec['lines']:
            product = line['product']
            line_subtotal = money(
                Decimal(str(line['quantity'])) * line['unit_price'] - line['discount']
            )
            db.add(SaleDetail(sale_id=sale.id, product_id=product.id,
                              quantity=line['quantity'], unit_price=line['unit_price'],
                              discount=line['discount'], subtotal=line_subtotal))
            if spec['status'] != 'cancelled':
                key = id(product)
                remaining[key] -= line['quantity']
                db.add(InventoryMovement(
                    product_id=product.id, movement_type='out', quantity=line['quantity'],
                    reason=f'Venta {sale.sale_number}', resulting_stock=remaining[key],
                    reference_id=sale.id, created_by=None,
                ))

        if spec['paid'] > 0:
            db.add(Payment(sale_id=sale.id, method=spec['method'], amount=spec['paid'],
                           paid_at=spec['sold_at']))

    db.commit()
    seed_extensions(db)

    ventas = sum(1 for spec in sale_specs if spec['status'] != 'cancelled')
    print(f'Seed completado: 1 empresa · {len(ROLES)} roles · {len(USERS)} usuarios · '
          f'{len(EMPLOYEES)} vendedores · {len(CATEGORIES)} categorías · '
          f'{len(PRODUCTS)} productos · {len(CUSTOMERS)} clientes · '
          f'{len(sale_specs)} ventas ({ventas} vigentes).')
    print(f'Acceso: admin@salesia.com / {DEMO_PASSWORD}')


def main() -> None:
    force = '--force' in sys.argv
    extend_only = '--extend' in sys.argv
    login_only = '--login' in sys.argv
    db = SessionLocal()
    try:
        if login_only:
            seed_login(db)
        elif extend_only:
            seed_extensions(db)
        else:
            seed(db, force=force)
    finally:
        db.close()


if __name__ == '__main__':
    main()
