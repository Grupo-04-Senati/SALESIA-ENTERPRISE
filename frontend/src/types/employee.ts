/**
 * Vendedores / empleados (docs/05_api.md §2.5, RF-05).
 */

/** Respuesta de GET/POST/PUT /api/v1/employees. */
export interface Employee {
  id: number
  full_name: string
  /** Alias que usa el almacén de ventas (igual que full_name). */
  name: string
  document: string | null
  position: string
  phone: string
  email: string
  hire_date: string | null
  hired_at: string | null
  status: 'active' | 'inactive'
  created_at?: string | null
  metrics?: {
    sales: number
    revenue: number
    average_ticket: number
  } | null
}

/** Payload de alta/edición de vendedor. */
export interface EmployeeInput {
  full_name: string
  document?: string | null
  position?: string | null
  phone?: string | null
  email?: string | null
  hire_date?: string | null
}
