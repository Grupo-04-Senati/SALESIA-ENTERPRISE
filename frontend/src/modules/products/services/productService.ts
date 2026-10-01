import type { Product, ProductInput } from '@/types/product'
import { getState, insertProduct, modifyProduct, setProductStatus } from '@/data/store'

/**
 * Servicio de productos y categorías (RF-04) sobre el almacén compartido.
 * El stock que muestra esta vista es el mismo que usa Inventario y que
 * descuenta el módulo de Ventas al registrar una venta.
 * TODO(Fase 05): GET/POST/PUT/PATCH /api/v1/products (docs/05_api.md §2.4).
 */

/** Categorías del catálogo. */
export const PRODUCT_CATEGORIES = getState().categories

export interface ProductFilters {
  search?: string
  category_id?: number | ''
  status?: 'active' | 'inactive' | ''
  /** Solo productos con stock ≤ mínimo (RF-04 low_stock). */
  low_stock?: boolean
}

const delay = (ms = 250): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return getState()
    .products.filter(
      (product) =>
        (!filters.status || product.status === filters.status) &&
        (!filters.category_id || product.category.id === filters.category_id) &&
        (!filters.low_stock || product.current_stock <= product.min_stock) &&
        (search === '' ||
          product.name.toLowerCase().includes(search) ||
          product.sku.toLowerCase().includes(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createProduct(input: ProductInput): Promise<Product> {
  return insertProduct(input)
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  return modifyProduct(id, input)
}

/** Activar / desactivar (PATCH /products/{id}/status). */
export async function toggleProductStatus(id: number): Promise<Product> {
  const product = getState().products.find((entry) => entry.id === id)
  if (!product) throw new Error('Producto no encontrado.')
  return setProductStatus(id, product.status === 'active' ? 'inactive' : 'active')
}
