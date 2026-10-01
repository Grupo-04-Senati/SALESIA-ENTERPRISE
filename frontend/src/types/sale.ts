/**
 * Tipos de ventas, pagos e inventario (docs/05_api.md §2.6, RF-06…RF-08).
 */

/** Estados de venta según API (docs/05_api.md §2.6). */
export type SaleStatus = 'pending' | 'paid' | 'partial' | 'cancelled'

/** Métodos de pago (docs/04_modelo_er.md, tabla payments). */
export type PaymentMethod = 'cash' | 'card' | 'transfer'

export interface SaleItem {
  product_id: number
  sku?: string
  name?: string
  quantity: number
  unit_price: number
  discount: number
  subtotal?: number
}

export interface Sale {
  id: number
  sale_number: string
  customer: { id: number; name: string }
  seller: { id: number; name: string }
  issued_at: string
  status: SaleStatus
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  /** Monto pagado y saldo pendiente (RF-07). */
  paid: number
  balance: number
  cancelled_at: string | null
  cancel_reason: string | null
}

/** Payload para registrar venta (el backend recalcula totales, RN-11). */
export interface SaleInput {
  customer_id: number
  seller_id: number
  items: Array<{ product_id: number; quantity: number; unit_price: number; discount: number }>
  payment: { method: PaymentMethod; amount: number }
  tax_rate: number
}

/** Respuesta al crear venta (201). */
export interface SaleCreated {
  id: number
  sale_number: string
  subtotal: number
  discount: number
  tax: number
  total: number
  status: SaleStatus
  inventory_updated: boolean
}

/** Tipos de movimiento de inventario (RF-08). */
export type MovementType = 'IN' | 'OUT' | 'RETURN' | 'SHRINKAGE' | 'ADJUSTMENT'

export interface InventoryMovement {
  id: number
  product_id: number
  sku: string
  type: MovementType
  quantity: number
  resulting_stock: number
  /** Obligatorio en SHRINKAGE y ADJUSTMENT (RN-21). */
  reason: string
  user: { id: number; name: string }
  created_at: string
}
