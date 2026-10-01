import type { Customer, CustomerInput } from '@/types/customer'
import type { Sale } from '@/types/sale'
import {
  getState,
  insertCustomer,
  modifyCustomer,
  setCustomerStatus,
} from '@/data/store'

/**
 * Servicio de clientes (RF-03) sobre el almacén compartido.
 * El historial se calcula con las ventas reales del sistema: al registrar
 * una venta, el cliente aparece con una compra más.
 * TODO(Fase 05): GET/POST/PUT/DELETE /api/v1/customers (docs/05_api.md §2.3).
 */

/** Segmentos comerciales. */
export const CUSTOMER_SEGMENTS = ['Nuevo', 'Ocasional', 'Recurrente', 'Frecuente'] as const

export interface CustomerFilters {
  search?: string
  segment?: string
  status?: 'active' | 'inactive' | ''
}

const delay = (ms = 250): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function listCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return getState()
    .customers.filter(
      (customer) =>
        (!filters.status || customer.status === filters.status) &&
        (!filters.segment || customer.segment === filters.segment) &&
        (search === '' ||
          customer.name.toLowerCase().includes(search) ||
          customer.document_number.includes(search) ||
          customer.email.toLowerCase().includes(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return insertCustomer(input)
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  return modifyCustomer(id, input)
}

/** Baja lógica (RF-03): el historial de compras se conserva. */
export async function deactivateCustomer(id: number): Promise<Customer> {
  return setCustomerStatus(id, 'inactive')
}

export interface CustomerPurchase {
  sale_number: string
  issued_at: string
  total: number
  status: Sale['status']
}

/** Historial real de compras del cliente (GET /customers/{id}/history). */
export async function getCustomerHistory(customer: Customer): Promise<CustomerPurchase[]> {
  await delay(200)
  return getState()
    .sales.filter((sale) => sale.customer.id === customer.id)
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
    .map((sale) => ({
      sale_number: sale.sale_number,
      issued_at: sale.issued_at,
      total: sale.total,
      status: sale.status,
    }))
}
