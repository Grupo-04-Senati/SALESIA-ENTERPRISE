import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Interacciones con clientes (ENDPOINTS.interactions) contra la API.
 * Cada registro indica quién lo hizo (performed_by) y cuándo ocurrió.
 */

export type InteractionKind = 'note' | 'call' | 'email' | 'meeting' | 'visit'

export const INTERACTION_LABELS: Record<InteractionKind, string> = {
  note: 'Nota',
  call: 'Llamada',
  email: 'Correo',
  meeting: 'Reunión',
  visit: 'Visita',
}

export interface CustomerInteraction {
  id: number
  customer_id: number
  customer_name: string
  kind: InteractionKind
  subject: string
  notes: string | null
  occurred_at: string | null
  performed_by: number | null
  performed_by_name: string | null
}

export interface InteractionInput {
  customer_id: number
  kind: InteractionKind
  subject: string
  notes?: string | null
  occurred_at?: string | null
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(path: string): Promise<CustomerInteraction[]> {
  const first = await apiFetch<Page<CustomerInteraction>>(`${path}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<CustomerInteraction>>(`${path}?page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))
}

export async function listInteractions(): Promise<CustomerInteraction[]> {
  return fetchAll(ENDPOINTS.interactions)
}

export async function createInteraction(input: InteractionInput): Promise<CustomerInteraction> {
  return apiFetch<CustomerInteraction>(ENDPOINTS.interactions, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateInteraction(
  id: number,
  input: InteractionInput,
): Promise<CustomerInteraction> {
  return apiFetch<CustomerInteraction>(`${ENDPOINTS.interactions}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteInteraction(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.interactions}/${id}`, { method: 'DELETE' })
}
