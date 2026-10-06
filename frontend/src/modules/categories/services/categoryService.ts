import type { Category, CategoryInput } from '@/types/product'
import { ApiError, apiFetch, API_BASE, getToken } from '@/services/api'
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

/** DELETE /categories/{id} — el backend rechaza el borrado si hay productos. */
export async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.categories}/${id}`, { method: 'DELETE' })
  await hydrateStore(['categories'])
}

/** Sube una imagen de categoría a Supabase Storage (POST /categories/image). */
export async function uploadCategoryImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${ENDPOINTS.categories}/image`, {
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
