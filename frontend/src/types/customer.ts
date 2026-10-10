/**
 * Tipos de clientes (docs/05_api.md §2.3, RF-03).
 */

export type CustomerStatus = 'active' | 'inactive'

export interface Customer {
  id: number
  document_type: string
  document_number: string
  name: string
  email: string
  phone: string
  address: string
  /** Segmento comercial (p. ej. "Recurrente"); valores según backend. */
  segment: string
  /** Línea comercial / giro del cliente (p. ej. "Mayorista"). */
  commercial_line?: string
  status: CustomerStatus
  created_at: string
  /** Compras registradas y monto acumulado (para ficha/historial). */
  purchase_count: number
  total_purchased: number
}

/** Datos para crear/editar (el backend no acepta los campos calculados). */
export type CustomerInput = Omit<
  Customer,
  'id' | 'status' | 'created_at' | 'purchase_count' | 'total_purchased'
>
