/**
 * Hidratación del almacén desde la API (Fase 05).
 *
 * Tras iniciar sesión —y tras cada escritura relevante— se cargan desde
 * FastAPI las secciones que alimentan los cálculos locales (Analytics,
 * Insights, Reportes, Probabilidad) y los selectores del formulario de
 * ventas (clientes, vendedores, productos).
 */

import { apiFetch } from './api'
import { ENDPOINTS } from './endpoints'
import { hydrate } from '@/data/store'
import type { SeedState } from '@/data/seed'
import type { Customer } from '@/types/customer'
import type { InventoryMovement, Sale, Seller } from '@/types/sale'
import type { Category, Product } from '@/types/product'

interface Page<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

/** Secciones del almacén que se pueden refrescar de forma independiente. */
export type Slice = 'categories' | 'products' | 'customers' | 'sales' | 'sellers' | 'movements'

const ALL_SLICES: Slice[] = ['categories', 'products', 'customers', 'sales', 'sellers', 'movements']

/** Recorre todas las páginas de un listado paginado (page_size máximo: 100). */
async function fetchAll<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const first = await apiFetch<Page<T>>(`${path}${separator}page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<T>>(`${path}${separator}page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items
}

async function loadSlice(slice: Slice): Promise<Partial<SeedState>> {
  switch (slice) {
    case 'categories':
      return { categories: await fetchAll<Category>(ENDPOINTS.categories) }
    case 'products':
      return { products: await fetchAll<Product>(ENDPOINTS.products) }
    case 'customers':
      return { customers: await fetchAll<Customer>(ENDPOINTS.customers) }
    case 'sales':
      return { sales: await fetchAll<Sale>(ENDPOINTS.sales) }
    case 'sellers':
      return { sellers: await fetchAll<Seller>(ENDPOINTS.employees) }
    case 'movements':
      return { movements: await fetchAll<InventoryMovement>(ENDPOINTS.inventoryMovements) }
    default:
      return {}
  }
}

let inflight: Promise<void> | null = null

/**
 * Carga desde la API las secciones indicadas (todas por defecto) y las
 * vuelca en el almacén, notificando a las vistas suscritas.
 * Las peticiones concurrentes (p. ej. StrictMode) comparten la misma
 * promesa para no duplicar la carga inicial.
 */
export function hydrateStore(slices: Slice[] = ALL_SLICES): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    const loaded = await Promise.all(slices.map(loadSlice))
    hydrate(Object.assign({}, ...loaded) as Partial<SeedState>)
  })().finally(() => {
    inflight = null
  })
  return inflight
}
