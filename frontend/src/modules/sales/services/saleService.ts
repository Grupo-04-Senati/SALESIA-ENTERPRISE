import type { Sale, SaleInput, SaleItem, SaleStatus } from '@/types/sale'

/**
 * Servicio de ventas (RF-06, RF-07) con datos en memoria.
 * TODO(Fase 05): sustituir por `apiFetch` contra FastAPI
 * (POST/GET /api/v1/sales — docs/05_api.md §2.6).
 * El cálculo de totales replica RN-11 del backend para que la vista
 * muestre exactamente los mismos importes:
 *   subtotal = Σ (cantidad × precio)
 *   descuento = Σ descuentos de línea
 *   impuesto = (subtotal − descuento) × tasa
 *   total    = subtotal − descuento + impuesto
 */

/** Tasa de impuesto por defecto (IGV Perú). */
export const DEFAULT_TAX_RATE = 0.18

const CUSTOMERS = [
  { id: 1, name: 'María Quispe' },
  { id: 2, name: 'Jorge Ramírez' },
  { id: 3, name: 'Comercial Andina S.A.C.' },
  { id: 4, name: 'Lucía Fernández' },
  { id: 5, name: 'Carlos Ttito' },
  { id: 6, name: 'Ana Torres' },
  { id: 7, name: 'Luis Ríos' },
  { id: 8, name: 'Carmen Vega' },
]

const SELLERS = [
  { id: 3, name: 'Luis Ríos' },
  { id: 4, name: 'Carlos Peña' },
  { id: 2, name: 'Ana Torres' },
]

/** Catálogo mínimo para el carrito (mismos datos que el módulo Productos). */
export const SALE_PRODUCTS = [
  { id: 1, sku: 'SKU-0001', name: 'Gaseosa 500ml', sale_price: 5.0, stock: 96 },
  { id: 2, sku: 'SKU-0002', name: 'Agua mineral 1L', sale_price: 3.0, stock: 120 },
  { id: 4, sku: 'SKU-0004', name: 'Café molido 250g', sale_price: 18.5, stock: 45 },
  { id: 5, sku: 'SKU-0005', name: 'Azúcar 1kg', sale_price: 4.8, stock: 80 },
  { id: 8, sku: 'SKU-0008', name: 'Pan de molde', sale_price: 4.0, stock: 35 },
  { id: 12, sku: 'SKU-0012', name: 'Detergente 1kg', sale_price: 12.5, stock: 30 },
  { id: 16, sku: 'SKU-0016', name: 'Leche entera 1L', sale_price: 4.9, stock: 70 },
  { id: 18, sku: 'SKU-0018', name: 'Shampoo 400ml', sale_price: 16.9, stock: 28 },
]

export const SALE_CUSTOMERS = CUSTOMERS
export const SALE_SELLERS = SELLERS

const round2 = (value: number): number => Math.round(value * 100) / 100

const SEED_ITEMS: Array<[number, number, number, number]> = [
  [1, 6, 5.0, 0],
  [2, 3, 3.0, 0],
  [4, 2, 18.5, 0],
  [5, 4, 4.8, 2],
  [8, 2, 4.0, 0],
  [12, 1, 12.5, 0],
  [16, 6, 4.9, 0],
  [18, 1, 16.9, 0],
]

/** Construye una venta con los totales calculados (RN-11). */
function buildSale(
  id: number,
  customer: { id: number; name: string },
  seller: { id: number; name: string },
  issuedAt: string,
  status: SaleStatus,
  itemSpecs: Array<[number, number, number, number]>,
  paidRatio: number,
): Sale {
  const items: SaleItem[] = itemSpecs.map(([productId, quantity, unitPrice, discount]) => {
    const product = SALE_PRODUCTS.find((entry) => entry.id === productId) ?? SALE_PRODUCTS[0]
    return {
      product_id: productId,
      sku: product.sku,
      name: product.name,
      quantity,
      unit_price: unitPrice,
      discount,
      subtotal: round2(quantity * unitPrice - discount),
    }
  })
  const subtotal = round2(items.reduce((total, item) => total + item.quantity * item.unit_price, 0))
  const discount = round2(items.reduce((total, item) => total + item.discount, 0))
  const tax = round2((subtotal - discount) * DEFAULT_TAX_RATE)
  const total = round2(subtotal - discount + tax)
  const paid = round2(total * paidRatio)
  return {
    id,
    sale_number: `V-2026-${String(1000 + id).padStart(6, '0')}`,
    customer,
    seller,
    issued_at: issuedAt,
    status,
    items,
    subtotal,
    discount,
    tax,
    total,
    paid,
    balance: round2(total - paid),
    cancelled_at: null,
    cancel_reason: null,
  }
}

const SEED: Sale[] = [
  buildSale(1, CUSTOMERS[0], SELLERS[0], '2026-09-28T10:15:00Z', 'paid', [SEED_ITEMS[0], SEED_ITEMS[2]], 1),
  buildSale(2, CUSTOMERS[1], SELLERS[1], '2026-09-27T16:40:00Z', 'paid', [SEED_ITEMS[1], SEED_ITEMS[3], SEED_ITEMS[4]], 1),
  buildSale(3, CUSTOMERS[2], SELLERS[0], '2026-09-26T11:05:00Z', 'partial', [SEED_ITEMS[5], SEED_ITEMS[6]], 0.5),
  buildSale(4, CUSTOMERS[3], SELLERS[2], '2026-09-25T09:20:00Z', 'paid', [SEED_ITEMS[0], SEED_ITEMS[1]], 1),
  buildSale(5, CUSTOMERS[4], SELLERS[1], '2026-09-24T15:30:00Z', 'pending', [SEED_ITEMS[2], SEED_ITEMS[7]], 0),
  buildSale(6, CUSTOMERS[5], SELLERS[2], '2026-09-22T12:00:00Z', 'paid', [SEED_ITEMS[3], SEED_ITEMS[6]], 1),
  buildSale(7, CUSTOMERS[6], SELLERS[0], '2026-09-20T10:45:00Z', 'cancelled', [SEED_ITEMS[0], SEED_ITEMS[4]], 0),
  buildSale(8, CUSTOMERS[7], SELLERS[1], '2026-09-18T14:10:00Z', 'paid', [SEED_ITEMS[5], SEED_ITEMS[7]], 1),
  buildSale(9, CUSTOMERS[1], SELLERS[2], '2026-09-15T08:50:00Z', 'paid', [SEED_ITEMS[0], SEED_ITEMS[2], SEED_ITEMS[6]], 1),
  buildSale(10, CUSTOMERS[2], SELLERS[0], '2026-09-12T17:25:00Z', 'partial', [SEED_ITEMS[1], SEED_ITEMS[3]], 0.4),
  buildSale(11, CUSTOMERS[4], SELLERS[1], '2026-09-10T13:15:00Z', 'paid', [SEED_ITEMS[4], SEED_ITEMS[5]], 1),
  buildSale(12, CUSTOMERS[0], SELLERS[2], '2026-09-08T09:30:00Z', 'paid', [SEED_ITEMS[7]], 1),
]

let sales: Sale[] = SEED.map((seed) => ({ ...seed }))

const delay = (ms = 400): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface SaleFilters {
  status?: SaleStatus | ''
  search?: string
}

export async function listSales(filters: SaleFilters = {}): Promise<Sale[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return sales
    .filter((sale) => (!filters.status || sale.status === filters.status) && (!search || sale.sale_number.toLowerCase().includes(search) || sale.customer.name.toLowerCase().includes(search)))
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
}

/** Totales calculados de una venta a partir de sus líneas. */
export function computeTotals(
  items: Array<{ quantity: number; unit_price: number; discount: number }>,
  taxRate = DEFAULT_TAX_RATE,
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = round2(items.reduce((total, item) => total + item.quantity * item.unit_price, 0))
  const discount = round2(items.reduce((total, item) => total + item.discount, 0))
  const tax = round2((subtotal - discount) * taxRate)
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) }
}

/** Registra una venta (POST /api/v1/sales). */
export async function createSale(input: SaleInput): Promise<Sale> {
  await delay()
  if (input.items.length === 0) {
    throw new Error('Agrega al menos un producto a la venta.')
  }
  // RN-10: stock insuficiente.
  for (const item of input.items) {
    const product = SALE_PRODUCTS.find((entry) => entry.id === item.product_id)
    if (!product) throw new Error('Producto no encontrado en el catálogo.')
    if (item.quantity > product.stock) {
      throw new Error(`Stock insuficiente de ${product.name} (disponible: ${product.stock}).`)
    }
  }
  // RN-16: el pago no puede exceder el total.
  const { subtotal, discount, tax, total } = computeTotals(input.items, input.tax_rate)
  if (input.payment.amount > total) {
    throw new Error('El pago no puede superar el total de la venta.')
  }

  const customer = CUSTOMERS.find((entry) => entry.id === input.customer_id)
  const seller = SELLERS.find((entry) => entry.id === input.seller_id)
  if (!customer || !seller) throw new Error('Cliente o vendedor no válido.')

  const id = Math.max(...sales.map((sale) => sale.id), 0) + 1
  const paid = round2(input.payment.amount)
  const sale: Sale = {
    id,
    sale_number: `V-2026-${String(1000 + id).padStart(6, '0')}`,
    customer,
    seller,
    issued_at: new Date().toISOString(),
    status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending',
    items: input.items.map((item) => {
      const product = SALE_PRODUCTS.find((entry) => entry.id === item.product_id) ?? SALE_PRODUCTS[0]
      return {
        ...item,
        sku: product.sku,
        name: product.name,
        subtotal: round2(item.quantity * item.unit_price - item.discount),
      }
    }),
    subtotal,
    discount,
    tax,
    total,
    paid,
    balance: round2(total - paid),
    cancelled_at: null,
    cancel_reason: null,
  }
  sales = [sale, ...sales]
  return sale
}
