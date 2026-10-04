import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de devoluciones (FE-2 · /devoluciones) contra la API.
 * Los listados llegan paginados: se piden completos con page=1&page_size=100.
 * Aprobar una devolución repone el stock en el backend, así que después de
 * la petición se refrescan productos y movimientos del almacén.
 */

interface Page<T> {
  items: T[]
}

export type ReturnStatus = 'pending' | 'completed' | 'rejected'

export interface ReturnLine {
  product_id: number
  quantity: number
}

export interface ReturnItem extends ReturnLine {
  id?: number
  product_name?: string
  unit_price?: number
  subtotal?: number
}

export interface SalesReturn {
  id: number
  return_number: string
  sale_id: number
  sale_number: string
  reason: string
  status: ReturnStatus
  total: number
  item_count: number
  created_at: string
  items?: ReturnItem[]
}

export interface ReturnInput {
  sale_id: number
  reason: string
  items: ReturnLine[]
}

export async function listReturns(): Promise<SalesReturn[]> {
  const page = await apiFetch<Page<SalesReturn>>(`${ENDPOINTS.returns}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getReturn(id: number): Promise<SalesReturn> {
  return apiFetch<SalesReturn>(`${ENDPOINTS.returns}/${id}`)
}

export async function createReturn(input: ReturnInput): Promise<SalesReturn> {
  return apiFetch<SalesReturn>(ENDPOINTS.returns, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** PUT /returns/{id} — solo se puede editar mientras esté pendiente. */
export async function updateReturn(id: number, input: ReturnInput): Promise<SalesReturn> {
  return apiFetch<SalesReturn>(`${ENDPOINTS.returns}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** POST /returns/{id}/approve — repone el stock de cada producto devuelto. */
export async function approveReturn(id: number): Promise<SalesReturn> {
  const approved = await apiFetch<SalesReturn>(`${ENDPOINTS.returns}/${id}/approve`, {
    method: 'POST',
  })
  await hydrateStore(['products', 'movements'])
  return approved
}

/** PATCH /returns/{id}/status — rechazar la solicitud (solo desde pendiente). */
export async function setReturnStatus(id: number, status: ReturnStatus): Promise<SalesReturn> {
  return apiFetch<SalesReturn>(`${ENDPOINTS.returns}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteReturn(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.returns}/${id}`, { method: 'DELETE' })
}
