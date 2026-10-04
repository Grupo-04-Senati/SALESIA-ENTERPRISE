import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Segmentos de clientes (ENDPOINTS.segments) contra la API.
 * El «customer_count» lo calcula el backend contando los clientes
 * cuyo segmento coincide con el nombre.
 */

export interface CustomerSegment {
  id: number
  name: string
  description: string | null
  min_purchases: number
  min_total: number
  status: 'active' | 'inactive'
  customer_count: number
}

export interface SegmentInput {
  name: string
  description?: string | null
  min_purchases: number
  min_total: number
}

interface Page<T> {
  items: T[]
}

export async function listSegments(): Promise<CustomerSegment[]> {
  const page = await apiFetch<Page<CustomerSegment>>(
    `${ENDPOINTS.segments}?page=1&page_size=100`,
  )
  return [...page.items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createSegment(input: SegmentInput): Promise<CustomerSegment> {
  return apiFetch<CustomerSegment>(ENDPOINTS.segments, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSegment(id: number, input: SegmentInput): Promise<CustomerSegment> {
  return apiFetch<CustomerSegment>(`${ENDPOINTS.segments}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteSegment(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.segments}/${id}`, { method: 'DELETE' })
}
