import type { Sale, SaleInput, SaleStatus } from '@/types/sale'
import type { Customer } from '@/types/customer'
import type { Seller } from '@/types/sale'
import { getState, insertSale } from '@/data/store'
import type { SaleProcessResult } from '@/data/store'
import { DEFAULT_TAX_RATE, computeTotals } from '@/data/seed'

/**
 * Servicio de ventas (RF-06, RF-07) sobre el almacén compartido.
 * Registrar una venta actualiza en cascada el inventario, el historial del
 * cliente y los indicadores de analítica, y devuelve la traza del proceso.
 * TODO(Fase 05): POST/GET /api/v1/sales (docs/05_api.md §2.6).
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

/** Clientes y vendedores vigentes, leídos del almacén. */
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

const delay = (ms = 250): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function listSales(filters: SaleFilters = {}): Promise<Sale[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return getState()
    .sales.filter(
      (sale) =>
        (!filters.status || sale.status === filters.status) &&
        (search === '' ||
          sale.sale_number.toLowerCase().includes(search) ||
          sale.customer.name.toLowerCase().includes(search) ||
          sale.seller.name.toLowerCase().includes(search)),
    )
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
}

/** Registra la venta y devuelve el proceso ejecutado (traza de pasos). */
export async function createSale(input: SaleInput): Promise<SaleProcessResult> {
  return insertSale(input)
}
