import type { InventoryMovement, MovementType } from '@/types/sale'
import { getState, insertMovement } from '@/data/store'
import type { MovementInput, ProcessTrace } from '@/data/store'

/**
 * Servicio de inventario (RF-08) sobre el almacén compartido.
 * Las existencias son las mismas que muestra Productos y que descuentan
 * las ventas; el kardex registra tanto los movimientos manuales como las
 * salidas generadas por cada venta.
 * TODO(Fase 05): /api/v1/inventory y /api/v1/inventory/movements.
 */

/** Etiquetas en español de cada tipo de movimiento. */
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  RETURN: 'Devolución',
  SHRINKAGE: 'Merma',
  ADJUSTMENT: 'Ajuste',
}

export type { MovementInput, ProcessTrace }

export interface StockRow {
  product_id: number
  sku: string
  name: string
  category: string
  current_stock: number
  min_stock: number
  unit: string
}

const delay = (ms = 250): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function listStock(): Promise<StockRow[]> {
  await delay()
  return getState().products.map((product) => ({
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category.name,
    current_stock: product.current_stock,
    min_stock: product.min_stock,
    unit: product.unit,
  }))
}

export async function listMovements(): Promise<InventoryMovement[]> {
  await delay()
  return [...getState().movements].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Entrada, salida, devolución, merma o ajuste (RF-08, RN-21). */
export async function createMovement(
  input: MovementInput,
): Promise<{ movement: InventoryMovement; trace: ProcessTrace }> {
  return insertMovement(input)
}
