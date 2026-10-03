import type { InventoryMovement, MovementType } from '@/types/sale'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { getState, logProcessTrace } from '@/data/store'
import type { ProcessTrace } from '@/data/store'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de inventario (RF-08) contra la API (Fase 05 · docs/05 §2.6).
 * Las existencias y el kardex vienen del backend: las salidas de cada
 * venta las genera el servidor y los movimientos manuales se registran
 * con POST /inventory/movements (RN-20 · RN-21 · RN-23).
 */

/** Etiquetas en español de cada tipo de movimiento. */
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  RETURN: 'Devolución',
  SHRINKAGE: 'Merma',
  ADJUSTMENT: 'Ajuste',
}

export type { ProcessTrace }

/** Datos de un movimiento manual de inventario (POST /inventory/movements). */
export interface MovementInput {
  product_id: number
  type: MovementType
  quantity: number
  reason: string
}

export interface StockRow {
  product_id: number
  sku: string
  name: string
  category: string
  current_stock: number
  min_stock: number
  unit: string
}

interface Page<T> {
  items: T[]
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const first = await apiFetch<Page<T>>(`${path}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min((first as Page<T> & { pages?: number }).pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<T>>(`${path}?page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items
}

export async function listStock(): Promise<StockRow[]> {
  return fetchAll<StockRow>(ENDPOINTS.inventory)
}

export async function listMovements(): Promise<InventoryMovement[]> {
  const movements = await fetchAll<InventoryMovement>(ENDPOINTS.inventoryMovements)
  return movements.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Entrada, salida, devolución, merma o ajuste (RF-08, RN-21). */
export async function createMovement(
  input: MovementInput,
): Promise<{ movement: InventoryMovement; trace: ProcessTrace }> {
  const product = getState().products.find((entry) => entry.id === input.product_id)
  const previousStock = product?.current_stock ?? 0

  const movement = await apiFetch<InventoryMovement>(ENDPOINTS.inventoryMovements, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await hydrateStore(['movements', 'products'])

  const updated = getState().products.find((entry) => entry.id === input.product_id)
  const label = updated?.name ?? 'Producto'
  const trace = logProcessTrace(`${movement.type} · ${label}`, [
    {
      module: 'inventario',
      label: 'Existencia actualizada',
      detail: `${movement.sku}: ${previousStock} → ${movement.resulting_stock} ${updated?.unit ?? 'UND'}`,
    },
    {
      module: 'inventario',
      label: 'Kardex registrado',
      detail: `${movement.type} de ${movement.quantity} — ${movement.reason}`,
    },
  ])
  return { movement, trace }
}
