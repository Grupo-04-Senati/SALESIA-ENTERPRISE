import type { Customer, CustomerInput } from '@/types/customer'
import type { Sale } from '@/types/sale'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de clientes (RF-03) contra la API (Fase 05 · docs/05 §2.3).
 * El historial de compras se consulta en GET /customers/{id}/history y
 * las altas/ediciones se reflejan en los cálculos del almacén hidratado.
 */

/** Segmentos comerciales. */
export const CUSTOMER_SEGMENTS = ['Nuevo', 'Ocasional', 'Recurrente', 'Frecuente'] as const

/** Claves i18n de cada segmento (el valor del segmento sigue siendo dato). */
export const SEGMENT_KEYS: Record<string, string> = {
  'Nuevo': 'customers.segmento-nuevo',
  'Ocasional': 'customers.segmento-ocasional',
  'Recurrente': 'customers.segmento-recurrente',
  'Frecuente': 'customers.segmento-frecuente',
}

export interface CustomerFilters {
  search?: string
  segment?: string
  status?: 'active' | 'inactive' | ''
}

interface Page<T> {
  items: T[]
}

export async function listCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
  const search = filters.search?.trim() ?? ''
  const params = new URLSearchParams({ page: '1', page_size: '100' })
  if (search) params.set('q', search)
  if (filters.segment) params.set('segment', filters.segment)
  if (filters.status) params.set('status', filters.status)

  const page = await apiFetch<Page<Customer>>(`${ENDPOINTS.customers}?${params}`)
  const term = search.toLowerCase()
  return page.items
    .filter(
      (customer) =>
        (!filters.status || customer.status === filters.status) &&
        (!filters.segment || customer.segment === filters.segment) &&
        (term === '' ||
          customer.name.toLowerCase().includes(term) ||
          customer.document_number.includes(term) ||
          customer.email.toLowerCase().includes(term)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const customer = await apiFetch<Customer>(ENDPOINTS.customers, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await hydrateStore(['customers'])
  return customer
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  const customer = await apiFetch<Customer>(`${ENDPOINTS.customers}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  await hydrateStore(['customers'])
  return customer
}

/** Baja lógica (RF-03 · RN-02): el historial de compras se conserva. */
export async function deactivateCustomer(id: number): Promise<Customer> {
  const customer = await apiFetch<Customer>(`${ENDPOINTS.customers}/${id}`, {
    method: 'DELETE',
  })
  await hydrateStore(['customers'])
  return customer
}

export interface CustomerPurchase {
  sale_number: string
  issued_at: string
  total: number
  status: Sale['status']
}

/** Historial de compras del cliente (GET /customers/{id}/history). */
export async function getCustomerHistory(customer: Customer): Promise<CustomerPurchase[]> {
  const response = await apiFetch<{ history: CustomerPurchase[] }>(
    ENDPOINTS.customerHistory(customer.id),
  )
  return [...response.history].sort((a, b) => b.issued_at.localeCompare(a.issued_at))
}
