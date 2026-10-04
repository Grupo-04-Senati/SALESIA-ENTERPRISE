import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Almacenes y su stock por producto (ENDPOINTS.warehouses y
 * ENDPOINTS.warehouseStock) contra la API.
 */

export interface Warehouse {
  id: number
  code: string
  name: string
  address: string | null
  status: 'active' | 'inactive'
  stock_lines: number
  total_units: number
}

export interface WarehouseInput {
  code: string
  name: string
  address?: string | null
}

export interface WarehouseStockRow {
  id: number
  warehouse_id: number
  warehouse_name: string
  product_id: number
  product_name: string
  stock: number
  min_stock: number
}

export interface WarehouseStockInput {
  warehouse_id: number
  product_id: number
  stock: number
  min_stock: number
}

interface Page<T> {
  items: T[]
  pages?: number
}

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

export async function listWarehouses(): Promise<Warehouse[]> {
  const items = await fetchAll<Warehouse>(ENDPOINTS.warehouses)
  return items.sort((a, b) => a.code.localeCompare(b.code))
}

export async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  return apiFetch<Warehouse>(ENDPOINTS.warehouses, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateWarehouse(id: number, input: WarehouseInput): Promise<Warehouse> {
  return apiFetch<Warehouse>(`${ENDPOINTS.warehouses}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** El backend rechaza el borrado si el almacén tiene stock asignado. */
export async function deleteWarehouse(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.warehouses}/${id}`, { method: 'DELETE' })
}

export async function listWarehouseStock(warehouseId: number): Promise<WarehouseStockRow[]> {
  const items = await fetchAll<WarehouseStockRow>(
    `${ENDPOINTS.warehouseStock}?warehouse_id=${warehouseId}`,
  )
  return items.sort((a, b) => a.product_name.localeCompare(b.product_name))
}

export async function createWarehouseStock(
  input: WarehouseStockInput,
): Promise<WarehouseStockRow> {
  return apiFetch<WarehouseStockRow>(ENDPOINTS.warehouseStock, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateWarehouseStock(
  id: number,
  input: Partial<WarehouseStockInput>,
): Promise<WarehouseStockRow> {
  return apiFetch<WarehouseStockRow>(`${ENDPOINTS.warehouseStock}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteWarehouseStock(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.warehouseStock}/${id}`, { method: 'DELETE' })
}
