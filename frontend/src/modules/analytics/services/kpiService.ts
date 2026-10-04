import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Instantáneas de KPI (ENDPOINTS.kpiSnapshots) contra la API.
 * Al guardarla el backend calcula el valor del indicador para el
 * periodo indicado y lo devuelve en la respuesta.
 */

export type KpiCode = 'revenue' | 'sales_count' | 'avg_ticket' | 'customers' | 'low_stock'

export const KPI_LABELS: Record<KpiCode, string> = {
  revenue: 'Ingresos',
  sales_count: 'N.º de ventas',
  avg_ticket: 'Ticket promedio',
  customers: 'Clientes',
  low_stock: 'Productos con stock bajo',
}

export interface KpiSnapshot {
  id: number
  kpi_code: KpiCode
  period_start: string
  period_end: string
  value: number
  payload: Record<string, unknown> | null
  created_at: string
}

export interface KpiSnapshotInput {
  kpi_code: KpiCode
  period_start: string
  period_end: string
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(): Promise<KpiSnapshot[]> {
  const first = await apiFetch<Page<KpiSnapshot>>(`${ENDPOINTS.kpiSnapshots}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<KpiSnapshot>>(
      `${ENDPOINTS.kpiSnapshots}?page=${page}&page_size=100`,
    )
    items.push(...next.items)
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function listKpiSnapshots(): Promise<KpiSnapshot[]> {
  return fetchAll()
}

/** POST /kpi-snapshots: el backend computa `value` si no se envía. */
export async function createKpiSnapshot(input: KpiSnapshotInput): Promise<KpiSnapshot> {
  return apiFetch<KpiSnapshot>(ENDPOINTS.kpiSnapshots, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deleteKpiSnapshot(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.kpiSnapshots}/${id}`, { method: 'DELETE' })
}
