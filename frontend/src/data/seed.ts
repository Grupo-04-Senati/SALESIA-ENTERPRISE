import type { Category, Product } from '@/types/product'
import type { Customer } from '@/types/customer'
import type { InventoryMovement, Sale, Seller } from '@/types/sale'

/**
 * Estado inicial del almacén en memoria (Fase 05 · API real).
 *
 * La aplicación NO carga datos de demostración: el almacén arranca vacío y
 * se llena con lo que devuelve la API (services/hydrate.ts) y con los
 * registros que crea el usuario (categorías, vendedores, clientes,
 * productos, ventas e inventario). Así los gráficos reflejan siempre los
 * datos reales del proyecto.
 */

/** Tasa de impuesto por defecto (IGV Perú) — RN-11. */
export const DEFAULT_TAX_RATE = 0.18

const round2 = (value: number): number => Math.round(value * 100) / 100

/** Totales de una venta: subtotal, descuento, impuesto y total (RN-11). */
export function computeTotals(
  items: Array<{ quantity: number; unit_price: number; discount: number }>,
  taxRate = DEFAULT_TAX_RATE,
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = round2(items.reduce((total, item) => total + item.quantity * item.unit_price, 0))
  const discount = round2(items.reduce((total, item) => total + item.discount, 0))
  const tax = round2((subtotal - discount) * taxRate)
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) }
}

export interface SeedState {
  categories: Category[]
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  sellers: Seller[]
  movements: InventoryMovement[]
}

/** Estado inicial: vacío; los datos reales llegan de la API. */
export function createSeedState(): SeedState {
  return {
    categories: [],
    products: [],
    customers: [],
    sales: [],
    sellers: [],
    movements: [],
  }
}
