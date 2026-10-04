import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Unidades de medida (ENDPOINTS.units) contra la API.
 */

export interface Unit {
  id: number
  name: string
  symbol: string | null
  status: 'active' | 'inactive'
}

export interface UnitInput {
  name: string
  symbol?: string | null
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(): Promise<Unit[]> {
  const first = await apiFetch<Page<Unit>>(`${ENDPOINTS.units}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<Unit>>(`${ENDPOINTS.units}?page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

export async function listUnits(): Promise<Unit[]> {
  return fetchAll()
}

export async function createUnit(input: UnitInput): Promise<Unit> {
  return apiFetch<Unit>(ENDPOINTS.units, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateUnit(id: number, input: UnitInput): Promise<Unit> {
  return apiFetch<Unit>(`${ENDPOINTS.units}/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteUnit(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.units}/${id}`, { method: 'DELETE' })
}
