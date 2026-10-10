import type { Category, Product, ProductInput } from '@/types/product'
import { ApiError, apiFetch, API_BASE, getToken } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'
import { getState } from '@/data/store'

/**
 * Servicio de productos y categorías (RF-04) contra la API (Fase 05 ·
 * docs/05 §2.4). El stock que muestra esta vista es el mismo que usa
 * Inventario y que descuenta Ventas al registrar una venta.
 */

/** Categorías vigentes del catálogo (se hidrata desde GET /categories). */
export const getProductCategories = (): Category[] => getState().categories

export interface ProductFilters {
  search?: string
  category_id?: number | ''
  status?: 'active' | 'inactive' | ''
  /** Solo productos con stock ≤ mínimo (RF-04 low_stock). */
  low_stock?: boolean
}

interface Page<T> {
  items: T[]
}

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const search = filters.search?.trim() ?? ''
  const params = new URLSearchParams({ page: '1', page_size: '100' })
  if (search) params.set('q', search)
  if (filters.status) params.set('status', filters.status)
  if (filters.category_id) params.set('category_id', String(filters.category_id))
  if (filters.low_stock) params.set('low_stock', 'true')

  const page = await apiFetch<Page<Product>>(`${ENDPOINTS.products}?${params}`)
  const term = search.toLowerCase()
  return page.items
    .filter(
      (product) =>
        (!filters.status || product.status === filters.status) &&
        (!filters.category_id || product.category?.id === filters.category_id) &&
        (!filters.low_stock || product.current_stock <= product.min_stock) &&
        (term === '' ||
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const product = await apiFetch<Product>(ENDPOINTS.products, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await hydrateStore(['products'])
  return product
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  const product = await apiFetch<Product>(`${ENDPOINTS.products}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  await hydrateStore(['products'])
  return product
}

/** Sube una imagen de producto a Supabase Storage (POST /products/image). */
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${ENDPOINTS.products}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      body: form,
    })
  } catch {
    throw new ApiError('Error de red al subir la imagen', 0, 'NETWORK_ERROR')
  }

  const body = (await response.json().catch(() => null)) as { url?: string; message?: string; code?: string } | null
  if (!response.ok || !body?.url) {
    throw new ApiError(
      body?.message ?? 'No se pudo subir la imagen',
      response.status,
      body?.code ?? 'INTERNAL_ERROR',
    )
  }
  return body.url
}

/** Activar / desactivar (PATCH /products/{id}/status). */
export async function toggleProductStatus(id: number): Promise<Product> {
  const current = getState().products.find((entry) => entry.id === id)
  const status = current?.status === 'active' ? 'inactive' : 'active'
  const product = await apiFetch<Product>(ENDPOINTS.productStatus(id), {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  await hydrateStore(['products'])
  return product
}

// ------------------------------------------------------------------ kits

export interface KitComponent {
  id: number
  component_id: number
  sku: string
  name: string
  unit: string
  quantity: number
}

export interface KitComponentsResponse {
  product_id: number
  is_kit: boolean
  components: KitComponent[]
}

/** Componentes del kit (GET /products/{id}/components). */
export async function listKitComponents(productId: number): Promise<KitComponentsResponse> {
  return apiFetch<KitComponentsResponse>(ENDPOINTS.productComponents(productId))
}

/** Añade o actualiza un componente del kit (POST /products/{id}/components). */
export async function addKitComponent(
  productId: number,
  componentId: number,
  quantity: number,
): Promise<KitComponent> {
  return apiFetch<KitComponent>(ENDPOINTS.productComponents(productId), {
    method: 'POST',
    body: JSON.stringify({ component_id: componentId, quantity }),
  })
}

/** Quita un componente del kit (DELETE /products/{id}/components/{componentId}). */
export async function removeKitComponent(productId: number, componentId: number): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `${ENDPOINTS.productComponents(productId)}/${componentId}`,
    { method: 'DELETE' },
  )
}
