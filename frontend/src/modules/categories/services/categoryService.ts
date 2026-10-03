import type { Category, CategoryInput } from '@/types/product'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de categorías contra la API (docs/05 §2.4 · RF-04).
 * Tras cada escritura se refresca el almacén para que el selector de
 * productos y los filtros de Analytics vean la nueva categoría.
 */

interface Page<T> {
  items: T[]
}

export async function listCategories(): Promise<Category[]> {
  const page = await apiFetch<Page<Category>>(`${ENDPOINTS.categories}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const category = await apiFetch<Category>(ENDPOINTS.categories, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await hydrateStore(['categories'])
  return category
}

export async function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  const category = await apiFetch<Category>(`${ENDPOINTS.categories}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  await hydrateStore(['categories'])
  return category
}
