import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Conteos de stock (ENDPOINTS.stockCounts) contra la API.
 * El conteo nace en borrador, se confirma para aplicar los ajustes
 * de stock y solo entonces deja de poderse editar o eliminar.
 */

export type StockCountStatus = 'draft' | 'done'

export interface StockCount {
  id: number
  count_number: string
  warehouse_id: number
  warehouse_name: string
  status: StockCountStatus
  notes: string | null
  item_count: number
  counted_by_name: string | null
  created_at: string
}

export interface StockCountItem {
  id: number
  product_id: number
  product_name: string
  expected_qty: number
  counted_qty: number
  difference: number
}

export interface StockCountDetail extends StockCount {
  items: StockCountItem[]
}

export interface StockCountLine {
  product_id: number
  counted_qty: number
}

export interface StockCountInput {
  warehouse_id: number
  notes?: string | null
  items: StockCountLine[]
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(path: string): Promise<StockCount[]> {
  const first = await apiFetch<Page<StockCount>>(`${path}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<StockCount>>(`${path}?page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function listStockCounts(): Promise<StockCount[]> {
  return fetchAll(ENDPOINTS.stockCounts)
}

export async function getStockCount(id: number): Promise<StockCountDetail> {
  return apiFetch<StockCountDetail>(`${ENDPOINTS.stockCounts}/${id}`)
}

export async function createStockCount(input: StockCountInput): Promise<StockCount> {
  return apiFetch<StockCount>(ENDPOINTS.stockCounts, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Aplica las diferencias al inventario (solo borradores). */
export async function confirmStockCount(id: number): Promise<StockCount> {
  return apiFetch<StockCount>(`${ENDPOINTS.stockCounts}/${id}/confirm`, { method: 'POST' })
}

export async function deleteStockCount(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.stockCounts}/${id}`, { method: 'DELETE' })
}
