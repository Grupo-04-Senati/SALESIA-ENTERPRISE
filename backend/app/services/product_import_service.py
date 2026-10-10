"""Importación masiva de productos desde CSV (vista previa + ejecución).

El archivo se recibe como texto (lo lee el navegador y lo envía el frontend),
se detecta el delimitador (; de Excel en español o ,), se mapean encabezados
por sinónimos ES/EN y cada fila se valida antes de tocar la base. El
``stock_inicial`` se registra como movimiento de entrada en el kardex para que
las ventas futuras descuenten bien (RN-20…RN-23).
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationAppError
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.services.audit_service import write_audit

MAX_ROWS = 2000

SKU_PATTERN = re.compile(r'^[A-Za-z0-9][A-Za-z0-9\-_.]{0,49}$')

# campo canónico → sinónimos aceptados en el encabezado
HEADER_SYNONYMS: dict[str, set[str]] = {
    'sku': {'sku', 'codigo', 'cod', 'codigo producto'},
    'name': {'nombre', 'name', 'producto', 'descripcion producto'},
    'category': {'categoria', 'category', 'seccion'},
    'cost_price': {'precio_costo', 'costo', 'coste', 'cost_price', 'precio_compra'},
    'sale_price': {'precio_venta', 'precio', 'sale_price', 'price', 'pvp'},
    'wholesale_price': {'precio_mayoreo', 'mayoreo', 'wholesale_price'},
    'brand': {'marca', 'brand'},
    'stock_inicial': {'stock_inicial', 'stock', 'existencia', 'existencias', 'cantidad'},
    'stock_minimo': {'stock_minimo', 'minimo', 'min_stock', 'stock minimo'},
    'unit': {'unidad', 'unit', 'umedida'},
    'featured': {'destacado', 'featured'},
    'description': {'descripcion', 'description', 'detalles'},
}

REQUIRED_FIELDS = ('sku', 'name', 'category', 'sale_price')

TRUE_VALUES = {'true', '1', 'si', 'sí', 'yes', 'y', 'x'}
FALSE_VALUES = {'false', '0', 'no', 'n', ''}


def _normalize_header(value: str) -> str:
    text = unicodedata.normalize('NFD', (value or '').strip().lower())
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return re.sub(r'\s+', ' ', text).strip()


def _normalize_name(value: str) -> str:
    """Comparación de nombres de categoría sin acentos ni mayúsculas."""
    return _normalize_header(value)


def _detect_delimiter(sample: str) -> str:
    candidates = [';', ',', '\t', '|']
    best, best_count = ';', -1
    for char in candidates:
        count = sample.count(char)
        if count > best_count:
            best, best_count = char, count
    return best


def _parse_number(raw: str, *, decimal_comma: bool) -> Decimal:
    text = (raw or '').strip().replace(' ', '').replace('S/', '').replace('S\\', '')
    text = re.sub(r'[^0-9.,-]', '', text)
    if not text:
        raise ValueError('vacío')
    if decimal_comma:
        text = text.replace('.', '').replace(',', '.')
    else:
        if text.count(',') == 1 and '.' not in text:
            text = text.replace(',', '.')
        else:
            text = text.replace(',', '')
    value = Decimal(text)
    if value != value.to_integral_value() and len(text.split('.')[-1]) > 4:
        raise ValueError('demasiados decimales')
    return value


def _parse_int(raw: str, *, decimal_comma: bool) -> int:
    value = _parse_number(raw, decimal_comma=decimal_comma)
    if value != value.to_integral_value():
        raise ValueError('no es un entero')
    return int(value)


def _parse_bool(raw: str) -> bool:
    text = (raw or '').strip().lower()
    if text in TRUE_VALUES:
        return True
    if text in FALSE_VALUES:
        return False
    raise ValueError('booleano inválido')


def _map_headers(header_row: list[str]) -> dict[int, str]:
    mapping: dict[int, str] = {}
    for index, raw in enumerate(header_row):
        normalized = _normalize_header(raw)
        for field, synonyms in HEADER_SYNONYMS.items():
            if normalized in synonyms:
                mapping[index] = field
                break
    return mapping


def _parse_rows(csv_text: str) -> tuple[list[dict], list[dict]]:
    """Devuelve (filas válidas con datos, filas con error de estructura)."""
    text = (csv_text or '').replace('\ufeff', '').strip('\n\r')
    if not text:
        raise ValidationAppError('El archivo está vacío.')
    delimiter = _detect_delimiter(text[:2000])
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        raise ValidationAppError('El archivo está vacío.')

    mapping = _map_headers(rows[0])
    missing = [field for field in REQUIRED_FIELDS if field not in mapping.values()]
    if missing:
        names = {
            'sku': 'sku/codigo', 'name': 'nombre', 'category': 'categoria',
            'sale_price': 'precio_venta',
        }
        raise ValidationAppError(
            'Faltan columnas obligatorias: ' + ', '.join(names[field] for field in missing) + '.'
        )

    decimal_comma = delimiter == ';'
    valid: list[dict] = []
    errors: list[dict] = []
    seen_skus: set[str] = set()

    for line_number, row in enumerate(rows[1:], start=2):
        if line_number - 1 > MAX_ROWS:
            errors.append({'line': line_number, 'errors': ['Archivo demasiado largo.']})
            break
        if not any((cell or '').strip() for cell in row):
            continue

        data: dict[str, object] = {}
        row_errors: list[str] = []
        for index, field in mapping.items():
            if index < len(row):
                data[field] = (row[index] or '').strip()

        sku = str(data.get('sku', ''))
        if not sku:
            row_errors.append('SKU vacío.')
        elif not SKU_PATTERN.match(sku):
            row_errors.append('SKU inválido (solo letras, números, - _ .).')
        elif sku.lower() in seen_skus:
            row_errors.append('SKU repetido en el archivo.')
        seen_skus.add(sku.lower())

        name = str(data.get('name', ''))
        if not name:
            row_errors.append('Nombre vacío.')
        elif len(name) > 150:
            row_errors.append('Nombre demasiado largo (máx. 150).')

        category = str(data.get('category', ''))
        if not category:
            row_errors.append('Categoría vacía.')
        elif len(category) > 100:
            row_errors.append('Categoría demasiado larga (máx. 100).')

        parsed: dict[str, object] = {
            'sku': sku, 'name': name, 'category': category,
            'brand': str(data.get('brand', ''))[:100] or None,
            'description': str(data.get('description', ''))[:500] or None,
            'unit': str(data.get('unit', ''))[:20] or 'UND',
        }

        for field, label, default in (
            ('cost_price', 'Precio de costo', Decimal('0')),
            ('sale_price', 'Precio de venta', None),
            ('wholesale_price', 'Precio mayoreo', None),
        ):
            raw = str(data.get(field, '') or '')
            if not raw:
                if default is None and field == 'sale_price':
                    row_errors.append('Precio de venta vacío.')
                elif default is not None:
                    parsed[field] = default
                continue
            try:
                parsed[field] = _parse_number(raw, decimal_comma=decimal_comma)
            except (ValueError, InvalidOperation):
                row_errors.append(f'{label} no es un número.')

        cost = parsed.get('cost_price')
        sale = parsed.get('sale_price')
        wholesale = parsed.get('wholesale_price')
        if isinstance(cost, Decimal) and isinstance(sale, Decimal) and sale < cost:
            row_errors.append('El precio de venta no puede ser menor al costo (RN-05).')
        if isinstance(wholesale, Decimal) and isinstance(sale, Decimal) and wholesale > sale:
            row_errors.append('El precio mayoreo no puede ser mayor al precio de venta.')

        for field, label in (('stock_inicial', 'Stock inicial'), ('stock_minimo', 'Stock mínimo')):
            raw = str(data.get(field, '') or '')
            if not raw:
                parsed[field] = 0
                continue
            try:
                value = _parse_int(raw, decimal_comma=decimal_comma)
                if value < 0:
                    raise ValueError('negativo')
                if value > 9_999_999:
                    raise ValueError('demasiado grande')
                parsed[field] = value
            except (ValueError, InvalidOperation):
                row_errors.append(f'{label} no es un entero válido.')

        raw_featured = str(data.get('featured', '') or '')
        try:
            parsed['featured'] = _parse_bool(raw_featured)
        except ValueError:
            row_errors.append('Destacado debe ser sí/no (o vacío).')

        entry = {'line': line_number, 'data': parsed}
        if row_errors:
            entry['errors'] = row_errors
            errors.append(entry)
        else:
            valid.append(entry)

    return valid, errors


def _category_ids(db: Session, company_id: int) -> dict[str, tuple[int, str]]:
    rows = db.execute(select(Category).where(Category.company_id == company_id)).scalars().all()
    return {_normalize_name(row.name): (row.id, row.name) for row in rows}


def _existing_skus(db: Session, company_id: int, skus: set[str]) -> dict[str, int]:
    """Mapa sku_en_minúsculas → id para los SKU indicados (comparación insensible a mayúsculas)."""
    if not skus:
        return {}
    rows = db.execute(
        select(Product).where(
            Product.company_id == company_id,
            func.lower(Product.sku).in_(skus),
        )
    ).scalars().all()
    return {row.sku.lower(): row.id for row in rows}


def preview(db: Session, company_id: int, csv_text: str, *, update_existing: bool) -> dict:
    """Valida el CSV sin escribir nada y clasifica cada fila."""
    valid, failed_rows = _parse_rows(csv_text)
    categories = _category_ids(db, company_id)
    skus = {str(row['data']['sku']).lower() for row in valid}
    existing = _existing_skus(db, company_id, skus)

    rows_out: list[dict] = []
    will_create = will_update = skipped = 0
    new_categories: set[str] = set()

    for entry in failed_rows:
        rows_out.append({
            'line': entry['line'], 'ok': False, 'action': 'error',
            'errors': entry['errors'], 'data': entry.get('data'),
        })

    for entry in valid:
        data = entry['data']
        errors: list[str] = []
        category_key = _normalize_name(str(data['category']))
        category_known = category_key in categories
        if not category_known:
            new_categories.add(str(data['category']))

        sku_key = str(data['sku']).lower()
        exists = sku_key in existing
        action = 'create'
        if exists:
            if update_existing:
                action = 'update'
            else:
                errors.append('El SKU ya existe (activa «actualizar existentes» para sobrescribir).')

        if errors:
            skipped += 1
            rows_out.append({'line': entry['line'], 'ok': False, 'action': 'error', 'errors': errors, 'data': data})
            continue

        if action == 'update':
            will_update += 1
        else:
            will_create += 1
        rows_out.append({
            'line': entry['line'], 'ok': True, 'action': action, 'errors': [],
            'data': data, 'category_exists': category_known,
        })

    rows_out.sort(key=lambda row: row['line'])
    return {
        'total_rows': len(rows_out),
        'valid_rows': will_create + will_update,
        'error_rows': skipped + len(failed_rows),
        'will_create': will_create,
        'will_update': will_update,
        'new_categories': sorted(new_categories),
        'update_existing': update_existing,
        'rows': rows_out,
    }


def execute(
    db: Session,
    company_id: int,
    csv_text: str,
    *,
    update_existing: bool,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """Importa las filas válidas en una sola transacción (atómico).

    Las filas con errores se omiten y se cuentan en ``skipped``; la vista
    previa sirve para corregirlas antes de reintentar.
    """
    valid, failed = _parse_rows(csv_text)

    categories = _category_ids(db, company_id)
    skus = {str(row['data']['sku']).lower() for row in valid}
    existing = _existing_skus(db, company_id, skus)

    created = updated = categories_created = 0
    stock_moves = 0

    for entry in valid:
        data = entry['data']
        sku_key = str(data['sku']).lower()

        category_key = _normalize_name(str(data['category']))
        if category_key in categories:
            category_id = categories[category_key][0]
        else:
            category = Category(company_id=company_id, name=str(data['category']))
            db.add(category)
            db.flush()
            categories[category_key] = (category.id, category.name)
            categories_created += 1
            category_id = category.id

        cost = Decimal(str(data.get('cost_price', 0) or 0))
        sale = Decimal(str(data['sale_price']))
        wholesale_raw = data.get('wholesale_price')
        wholesale = Decimal(str(wholesale_raw)) if wholesale_raw not in (None, '') else None

        if sku_key in existing:
            product = db.execute(
                select(Product).where(
                    Product.company_id == company_id, Product.id == existing[sku_key]
                )
            ).scalar_one()
            product.name = str(data['name'])
            product.category_id = category_id
            product.cost_price = cost
            product.price = sale
            product.wholesale_price = wholesale
            product.brand = data.get('brand') or None
            product.min_stock = int(data.get('stock_minimo', 0) or 0)
            product.unit = str(data.get('unit') or 'UND')
            product.description = data.get('description') or None
            product.is_featured = bool(data.get('featured'))
            stock = db.execute(
                select(Inventory).where(Inventory.product_id == product.id)
            ).scalar_one_or_none()
            if stock is not None:
                stock.min_stock = product.min_stock
            updated += 1
            continue

        product = Product(
            company_id=company_id,
            sku=str(data['sku']),
            name=str(data['name']),
            category_id=category_id,
            cost_price=cost,
            price=sale,
            wholesale_price=wholesale,
            brand=data.get('brand') or None,
            image_url=None,
            is_featured=bool(data.get('featured')),
            min_stock=int(data.get('stock_minimo', 0) or 0),
            unit=str(data.get('unit') or 'UND'),
            description=data.get('description') or None,
        )
        db.add(product)
        db.flush()

        initial_stock = int(data.get('stock_inicial', 0) or 0)
        db.add(Inventory(product_id=product.id, stock=initial_stock, min_stock=product.min_stock))
        if initial_stock > 0:
            db.add(InventoryMovement(
                product_id=product.id,
                movement_type='in',
                quantity=initial_stock,
                reason='Importación CSV',
                resulting_stock=initial_stock,
                created_by=getattr(actor, 'id', None),
            ))
            stock_moves += 1
        created += 1

    write_audit(
        db,
        user=actor,
        action='products.import',
        entity='products',
        detail={'created': created, 'updated': updated, 'categories_created': categories_created},
        ip_address=ip,
    )
    db.commit()
    return {
        'created': created,
        'updated': updated,
        'categories_created': categories_created,
        'stock_movements': stock_moves,
        'skipped': len(failed),
    }
