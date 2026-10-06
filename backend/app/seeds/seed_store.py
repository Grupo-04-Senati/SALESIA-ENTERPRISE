"""Importa el catálogo de la tienda web a SalesIA (idempotente).

Lee `src/data/products.json` y `src/data/categories.json` de la tienda,
sube las imágenes (SVG) a Supabase Storage y crea/actualiza categorías,
productos e inventario en la empresa por defecto.

Uso (desde backend/):
    python -m app.seeds.seed_store                  # crea lo que falte
    python -m app.seeds.seed_store --update         # además refresca precios/datos
    python -m app.seeds.seed_store --tienda RUTA    # ruta custom a la tienda
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.category import Category
from app.models.company import Company
from app.models.inventory import Inventory
from app.models.product import Product
from app.schemas.product import CategoryCreate, ProductCreate, ProductUpdate
from app.services import product_service, storage_service

MIME_BY_EXT = {'.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
               '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'}


def _default_tienda_path() -> Path:
    root = Path(__file__).resolve().parents[3]
    return root.parent / 'SALESIA-ENTERPRISE-main_tienda'


def _load_json(path: Path) -> list:
    return json.loads(path.read_text(encoding='utf-8-sig'))


def _upload(path: Path, folder: str, name: str) -> str | None:
    if not path.is_file():
        return None
    mime = MIME_BY_EXT.get(path.suffix.lower())
    if mime is None:
        return None
    try:
        return storage_service.upload_image(
            path.read_bytes(), folder=folder, name=name, content_type=mime
        )
    except Exception as exc:  # noqa: BLE001 - el import no debe frenar por una imagen
        print(f'  ! imagen {path.name}: {exc}')
        return None


def _set_stock(db, product_id: int, stock: int) -> None:
    row = db.execute(
        select(Inventory).where(Inventory.product_id == product_id)
    ).scalar_one_or_none()
    if row is None:
        db.add(Inventory(product_id=product_id, stock=stock, min_stock=0))
    else:
        row.stock = stock
    db.commit()


def run(tienda: Path, update: bool = False) -> int:
    categories = _load_json(tienda / 'src' / 'data' / 'categories.json')
    products = _load_json(tienda / 'src' / 'data' / 'products.json')
    public = tienda / 'public'

    db = SessionLocal()
    created_categories = updated_categories = 0
    created_products = updated_products = skipped = 0
    images = 0
    try:
        company = db.execute(select(Company).order_by(Company.id)).scalars().first()
        if company is None:
            print('X No hay empresa registrada: ejecuta primero python -m app.seeds.seed')
            return 1

        # ---------------------------------------------------------- categorías
        by_slug: dict[str, Category] = {}
        for raw in categories:
            existing = db.execute(
                select(Category).where(
                    Category.company_id == company.id, Category.name == raw['nombre']
                )
            ).scalar_one_or_none()

            image_url = existing.image_url if existing else None
            if not image_url:
                image_url = _upload(
                    public / raw['imagen'].lstrip('/'), 'categories', raw['id']
                )
                if image_url:
                    images += 1

            if existing is None:
                product_service.create_category(
                    db, company.id,
                    CategoryCreate(name=raw['nombre'], description=raw['descripcion'],
                                   image_url=image_url),
                )
                created_categories += 1
                existing = db.execute(
                    select(Category).where(
                        Category.company_id == company.id, Category.name == raw['nombre']
                    )
                ).scalar_one()
            elif image_url and not existing.image_url:
                existing.image_url = image_url
                db.commit()
                updated_categories += 1
            by_slug[raw['id']] = existing

        # ------------------------------------------------------------ productos
        for raw in products:
            category = by_slug.get(raw['categoria'])
            existing = db.execute(
                select(Product).where(
                    Product.company_id == company.id, Product.sku == raw['sku']
                )
            ).scalar_one_or_none()

            image_url = existing.image_url if existing else None
            if (existing is None or update or not image_url) and raw.get('imagenes'):
                url = _upload(
                    public / raw['imagenes'][0].lstrip('/'), 'products', raw['sku']
                )
                if url:
                    image_url = url
                    images += 1

            payload = dict(
                sku=raw['sku'],
                name=raw['nombre'],
                category_id=category.id if category else None,
                cost_price=0,
                sale_price=raw['precio'],
                wholesale_price=raw.get('precioMayorista'),
                brand=raw.get('marca'),
                image_url=image_url,
                is_featured=bool(raw.get('destacado')),
                min_stock=0,
                unit='UND',
                description=(raw.get('descripcion') or '')[:500] or None,
            )

            if existing is None:
                created = product_service.create_product(
                    db, company.id, ProductCreate(**payload)
                )
                _set_stock(db, created['id'], int(raw.get('stock') or 0))
                created_products += 1
            elif update:
                product_service.update_product(
                    db, company.id, existing.id, ProductUpdate(**payload)
                )
                updated_products += 1
            else:
                skipped += 1

        print('Importación de la tienda completada')
        print(f'  categorías: +{created_categories} creadas, {updated_categories} con imagen')
        print(f'  productos:  +{created_products} creados, {updated_products} actualizados, '
              f'{skipped} sin cambios (usa --update para refrescar)')
        print(f'  imágenes subidas: {images}')
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tienda', type=Path, default=_default_tienda_path(),
                        help='Ruta al proyecto de la tienda')
    parser.add_argument('--update', action='store_true',
                        help='Actualiza productos existentes (no toca el stock)')
    args = parser.parse_args()

    if not (args.tienda / 'src' / 'data' / 'products.json').is_file():
        print(f'X No encuentro la tienda en: {args.tienda}')
        return 1
    return run(args.tienda, update=args.update)


if __name__ == '__main__':
    sys.exit(main())
