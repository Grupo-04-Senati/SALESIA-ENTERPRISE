import type { InventoryMovement, MovementType } from '@/types/sale'
import { adjustStock, listProducts } from '@/modules/products/services/productService'

/**
 * Servicio de inventario (RF-08) con datos en memoria.
 * Reutiliza el stock del servicio de productos para que ambas vistas
 * (.Inventario y Productos) muestren siempre la misma existencia.
 * TODO(Fase 05): sustituir por `apiFetch` contra FastAPI
 * (docs/05_api.md §2.6 — inventario y movimientos).
 */

const USERS = [
  { id: 3, name: 'Luis Ríos' },
  { id: 4, name: 'Carlos Peña' },
  { id: 5, name: 'Rosa Huamán' },
]

/** Etiquetas en español de cada tipo de movimiento. */
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  RETURN: 'Devolución',
  SHRINKAGE: 'Merma',
  ADJUSTMENT: 'Ajuste',
}

/** Signo que cada movimiento aplica al stock. */
const MOVEMENT_DELTA: Record<MovementType, 1 | -1> = {
  IN: 1,
  RETURN: 1,
  OUT: -1,
  SHRINKAGE: -1,
  ADJUSTMENT: -1,
}

let movements: InventoryMovement[] = [
  { id: 88, product_id: 1, sku: 'SKU-0001', type: 'IN', quantity: 48, resulting_stock: 96, reason: 'Recepción de compra OC-0042', user: USERS[0], created_at: '2026-09-30T16:00:00Z' },
  { id: 87, product_id: 11, sku: 'SKU-0011', type: 'SHRINKAGE', quantity: 6, resulting_stock: 0, reason: 'Merma por productos dañados', user: USERS[2], created_at: '2026-09-30T11:20:00Z' },
  { id: 86, product_id: 17, sku: 'SKU-0017', type: 'OUT', quantity: 4, resulting_stock: 8, reason: 'Venta en mostrador', user: USERS[1], created_at: '2026-09-29T18:05:00Z' },
  { id: 85, product_id: 5, sku: 'SKU-0005', type: 'IN', quantity: 30, resulting_stock: 80, reason: 'Recepción de compra OC-0039', user: USERS[0], created_at: '2026-09-29T10:40:00Z' },
  { id: 84, product_id: 9, sku: 'SKU-0009', type: 'ADJUSTMENT', quantity: 2, resulting_stock: 12, reason: 'Ajuste por conteo físico', user: USERS[2], created_at: '2026-09-28T17:15:00Z' },
  { id: 83, product_id: 3, sku: 'SKU-0003', type: 'OUT', quantity: 6, resulting_stock: 18, reason: 'Venta en mostrador', user: USERS[1], created_at: '2026-09-28T09:30:00Z' },
  { id: 82, product_id: 12, sku: 'SKU-0012', type: 'RETURN', quantity: 2, resulting_stock: 30, reason: 'Devolución de cliente', user: USERS[0], created_at: '2026-09-27T15:50:00Z' },
  { id: 81, product_id: 6, sku: 'SKU-0006', type: 'OUT', quantity: 8, resulting_stock: 22, reason: 'Venta en mostrador', user: USERS[1], created_at: '2026-09-26T12:10:00Z' },
]

const delay = (ms = 400): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface MovementInput {
  product_id: number
  type: MovementType
  quantity: number
  /** Obligatorio en SHRINKAGE y ADJUSTMENT (RN-21). */
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

export async function listStock(): Promise<StockRow[]> {
  const products = await listProducts()
  return products.map((product) => ({
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
  return [...movements].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Registra entrada, salida, devolución, merma o ajuste (RF-08). */
export async function createMovement(input: MovementInput): Promise<InventoryMovement> {
  await delay()
  const quantity = Math.abs(Math.trunc(input.quantity))
  if (quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a cero.')
  }
  // RN-21: merma y ajuste exigen motivo.
  if ((input.type === 'SHRINKAGE' || input.type === 'ADJUSTMENT') && !input.reason.trim()) {
    throw new Error('Ingresa el motivo del movimiento (obligatorio en merma y ajuste).')
  }
  const products = await listProducts()
  const product = products.find((entry) => entry.id === input.product_id)
  if (!product) throw new Error('Producto no encontrado.')

  const updated = await adjustStock(product.id, MOVEMENT_DELTA[input.type] * quantity)
  const movement: InventoryMovement = {
    id: Math.max(...movements.map((existing) => existing.id), 0) + 1,
    product_id: product.id,
    sku: product.sku,
    type: input.type,
    quantity,
    resulting_stock: updated.current_stock,
    reason: input.reason.trim() || MOVEMENT_LABELS[input.type],
    user: USERS[0],
    created_at: new Date().toISOString(),
  }
  movements = [movement, ...movements]
  return movement
}
