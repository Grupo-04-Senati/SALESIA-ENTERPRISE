import type { Sale, SaleCreated, SaleInput, SaleStatus } from '@/types/sale'
import type { Customer } from '@/types/customer'
import type { Seller } from '@/types/sale'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { getState, logProcessTrace } from '@/data/store'
import type { ProcessTrace, SaleProcessResult } from '@/data/store'
import { hydrateStore } from '@/services/hydrate'
import { DEFAULT_TAX_RATE, computeTotals } from '@/data/seed'

/**
 * Servicio de ventas (RF-06, RF-07) contra la API (Fase 05 · docs/05 §2.6).
 * Registrar una venta descuenta stock, genera el kardex y actualiza el
 * historial del cliente en el backend; después se refresca el almacén y
 * se devuelve la traza de pasos que devuelve el servidor (RF trazabilidad).
 */

export { DEFAULT_TAX_RATE, computeTotals }

/** Producto disponible para el carrito (con su stock real). */
export interface SaleProduct {
  id: number
  sku: string
  name: string
  sale_price: number
  stock: number
}

/** Clientes y vendedores vigentes, leídos del almacén hidratado. */
export const getSaleCustomers = (): Pick<Customer, 'id' | 'name'>[] =>
  getState()
    .customers.filter((customer) => customer.status === 'active')
    .map((customer) => ({ id: customer.id, name: customer.name }))

export const getSaleSellers = (): Seller[] => getState().sellers

export const getSaleProducts = (): SaleProduct[] =>
  getState()
    .products.filter((product) => product.status === 'active')
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      sale_price: product.sale_price,
      stock: product.current_stock,
    }))

export interface SaleFilters {
  status?: SaleStatus | ''
  search?: string
}

interface Page<T> {
  items: T[]
}

export async function listSales(filters: SaleFilters = {}): Promise<Sale[]> {
  const search = filters.search?.trim() ?? ''
  const params = new URLSearchParams({ page: '1', page_size: '100' })
  if (filters.status) params.set('status', filters.status)
  if (search) params.set('q', search)

  const page = await apiFetch<Page<Sale>>(`${ENDPOINTS.sales}?${params}`)
  const term = search.toLowerCase()
  return page.items
    .filter(
      (sale) =>
        (!filters.status || sale.status === filters.status) &&
        (term === '' ||
          sale.sale_number.toLowerCase().includes(term) ||
          sale.customer.name.toLowerCase().includes(term) ||
          sale.seller.name.toLowerCase().includes(term)),
    )
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
}

/** Registra la venta en el backend y devuelve el proceso ejecutado. */
export async function createSale(input: SaleInput): Promise<SaleProcessResult> {
  const created = await apiFetch<SaleCreated & { trace?: ProcessTrace['steps'] }>(ENDPOINTS.sales, {
    method: 'POST',
    body: JSON.stringify({ ...input, tax_rate: input.tax_rate ?? DEFAULT_TAX_RATE }),
  })

  await hydrateStore(['sales', 'products', 'movements', 'customers'])
  const sale = await apiFetch<Sale>(`${ENDPOINTS.sales}/${created.id}`)
  const trace = logProcessTrace(
    `Venta ${created.sale_number}`,
    created.trace ?? [
      {
        module: 'ventas',
        label: 'Venta registrada',
        detail: `${created.sale_number} · total S/ ${created.total.toFixed(2)} · estado ${created.status}`,
      },
    ],
  )
  return { sale, trace }
}
