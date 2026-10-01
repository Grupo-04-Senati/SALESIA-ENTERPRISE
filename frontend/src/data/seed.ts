import type { Category, Product, ProductInput } from '@/types/product'
import type { Customer, CustomerInput } from '@/types/customer'
import type { InventoryMovement, Sale, SaleItem, SaleStatus, Seller } from '@/types/sale'

/**
 * Datos de demostración del sistema (Fase 03 · modo demo).
 * Fuente única de verdad para productos, clientes, ventas y movimientos:
 * todos los módulos (Ventas, Inventario, Analytics, Insights, Probabilidad,
 * Reportes y Dashboard) leen y escriben sobre este mismo conjunto, de modo
 * que un cambio en un módulo se refleja automáticamente en los demás.
 *
 * TODO(Fase 05): sustituir por PostgreSQL vía API (docs/05_api.md).
 */

export const SELLERS: Seller[] = [
  { id: 3, name: 'Luis Ríos' },
  { id: 4, name: 'Carlos Peña' },
  { id: 2, name: 'Ana Torres' },
]

export const CATEGORIES: Category[] = [
  { id: 1, name: 'Bebidas', status: 'active' },
  { id: 2, name: 'Abarrotes', status: 'active' },
  { id: 3, name: 'Panadería', status: 'active' },
  { id: 4, name: 'Frutas y Verduras', status: 'active' },
  { id: 5, name: 'Limpieza', status: 'active' },
  { id: 6, name: 'Snacks', status: 'active' },
  { id: 7, name: 'Lácteos', status: 'active' },
  { id: 8, name: 'Cuidado personal', status: 'active' },
]

interface SeedProduct extends ProductInput {
  id: number
  current_stock: number
  status: 'active' | 'inactive'
  created_at: string
}

const SEED_PRODUCTS: SeedProduct[] = [
  { id: 1, sku: 'SKU-0001', name: 'Gaseosa 500ml', category_id: 1, cost_price: 3.5, sale_price: 5.0, min_stock: 24, unit: 'UND', current_stock: 96, status: 'active', created_at: '2026-02-01T09:00:00Z' },
  { id: 2, sku: 'SKU-0002', name: 'Agua mineral 1L', category_id: 1, cost_price: 2.0, sale_price: 3.0, min_stock: 36, unit: 'UND', current_stock: 120, status: 'active', created_at: '2026-02-01T09:05:00Z' },
  { id: 3, sku: 'SKU-0003', name: 'Jugo de naranja 1L', category_id: 1, cost_price: 4.5, sale_price: 6.5, min_stock: 24, unit: 'UND', current_stock: 18, status: 'active', created_at: '2026-02-03T10:15:00Z' },
  { id: 4, sku: 'SKU-0004', name: 'Café molido 250g', category_id: 2, cost_price: 12.0, sale_price: 18.5, min_stock: 12, unit: 'UND', current_stock: 45, status: 'active', created_at: '2026-02-05T11:30:00Z' },
  { id: 5, sku: 'SKU-0005', name: 'Azúcar 1kg', category_id: 2, cost_price: 3.2, sale_price: 4.8, min_stock: 30, unit: 'UND', current_stock: 80, status: 'active', created_at: '2026-02-05T11:35:00Z' },
  { id: 6, sku: 'SKU-0006', name: 'Arroz premium 1kg', category_id: 2, cost_price: 4.1, sale_price: 5.9, min_stock: 30, unit: 'UND', current_stock: 22, status: 'active', created_at: '2026-02-08T08:20:00Z' },
  { id: 7, sku: 'SKU-0007', name: 'Aceite vegetal 1L', category_id: 2, cost_price: 6.5, sale_price: 9.2, min_stock: 18, unit: 'UND', current_stock: 40, status: 'active', created_at: '2026-02-10T14:00:00Z' },
  { id: 8, sku: 'SKU-0008', name: 'Pan de molde', category_id: 3, cost_price: 2.8, sale_price: 4.0, min_stock: 20, unit: 'UND', current_stock: 35, status: 'active', created_at: '2026-02-12T07:45:00Z' },
  { id: 9, sku: 'SKU-0009', name: 'Croissant', category_id: 3, cost_price: 1.5, sale_price: 2.5, min_stock: 24, unit: 'UND', current_stock: 12, status: 'active', created_at: '2026-02-12T07:50:00Z' },
  { id: 10, sku: 'SKU-0010', name: 'Manzana roja 1kg', category_id: 4, cost_price: 3.0, sale_price: 4.5, min_stock: 15, unit: 'UND', current_stock: 50, status: 'active', created_at: '2026-02-15T09:10:00Z' },
  { id: 11, sku: 'SKU-0011', name: 'Plátano 1kg', category_id: 4, cost_price: 2.2, sale_price: 3.2, min_stock: 20, unit: 'UND', current_stock: 0, status: 'active', created_at: '2026-02-15T09:15:00Z' },
  { id: 12, sku: 'SKU-0012', name: 'Detergente 1kg', category_id: 5, cost_price: 8.0, sale_price: 12.5, min_stock: 12, unit: 'UND', current_stock: 30, status: 'active', created_at: '2026-02-18T16:30:00Z' },
  { id: 13, sku: 'SKU-0013', name: 'Jabón de tocador x3', category_id: 5, cost_price: 4.5, sale_price: 6.8, min_stock: 18, unit: 'UND', current_stock: 25, status: 'active', created_at: '2026-02-18T16:35:00Z' },
  { id: 14, sku: 'SKU-0014', name: 'Papas fritas 100g', category_id: 6, cost_price: 2.5, sale_price: 3.8, min_stock: 30, unit: 'UND', current_stock: 60, status: 'active', created_at: '2026-02-20T10:00:00Z' },
  { id: 15, sku: 'SKU-0015', name: 'Chocolate 100g', category_id: 6, cost_price: 3.8, sale_price: 5.5, min_stock: 24, unit: 'UND', current_stock: 40, status: 'active', created_at: '2026-02-20T10:05:00Z' },
  { id: 16, sku: 'SKU-0016', name: 'Leche entera 1L', category_id: 7, cost_price: 3.6, sale_price: 4.9, min_stock: 36, unit: 'UND', current_stock: 70, status: 'active', created_at: '2026-02-22T08:00:00Z' },
  { id: 17, sku: 'SKU-0017', name: 'Queso fresco 500g', category_id: 7, cost_price: 9.0, sale_price: 13.5, min_stock: 10, unit: 'UND', current_stock: 8, status: 'active', created_at: '2026-02-22T08:05:00Z' },
  { id: 18, sku: 'SKU-0018', name: 'Shampoo 400ml', category_id: 8, cost_price: 11.0, sale_price: 16.9, min_stock: 12, unit: 'UND', current_stock: 28, status: 'active', created_at: '2026-02-25T13:20:00Z' },
  { id: 19, sku: 'SKU-0019', name: 'Pasta dental', category_id: 8, cost_price: 5.5, sale_price: 8.2, min_stock: 15, unit: 'UND', current_stock: 33, status: 'active', created_at: '2026-02-25T13:25:00Z' },
  { id: 20, sku: 'SKU-0020', name: 'Gaseosa cola 2L', category_id: 1, cost_price: 5.5, sale_price: 8.0, min_stock: 20, unit: 'UND', current_stock: 55, status: 'inactive', created_at: '2026-03-01T09:30:00Z' },
]

interface SeedCustomer extends CustomerInput {
  id: number
  status: 'active' | 'inactive'
  created_at: string
  purchase_count: number
  total_purchased: number
}

const SEED_CUSTOMERS: SeedCustomer[] = [
  { id: 1, document_type: 'DNI', document_number: '74125896', name: 'María Quispe', email: 'maria.quispe@correo.com', phone: '+51987654321', address: 'Av. Los Olivos 123, Lima', segment: 'Recurrente', status: 'active', created_at: '2026-03-14T10:05:00Z', purchase_count: 18, total_purchased: 1450.5 },
  { id: 2, document_type: 'DNI', document_number: '45812369', name: 'Jorge Ramírez', email: 'jorge.ramirez@correo.com', phone: '+51912345678', address: 'Jr. Cusco 450, Wanchaq, Cusco', segment: 'Frecuente', status: 'active', created_at: '2025-11-02T15:40:00Z', purchase_count: 34, total_purchased: 3820.9 },
  { id: 3, document_type: 'RUC', document_number: '20512345678', name: 'Comercial Andina S.A.C.', email: 'compras@comercialandina.pe', phone: '+51988112233', address: 'Av. Argentina 2890, Callao', segment: 'Frecuente', status: 'active', created_at: '2025-09-18T09:15:00Z', purchase_count: 41, total_purchased: 12850.0 },
  { id: 4, document_type: 'DNI', document_number: '60238741', name: 'Lucía Fernández', email: 'lucia.fernandez@correo.com', phone: '+51999887766', address: 'Calle Los Pinos 222, San Isidro', segment: 'Nuevo', status: 'active', created_at: '2026-06-21T12:00:00Z', purchase_count: 2, total_purchased: 145.8 },
  { id: 5, document_type: 'DNI', document_number: '72341589', name: 'Carlos Ttito', email: 'carlos.ttito@correo.com', phone: '+51955443322', address: 'Av. Del Sol 412, Cusco', segment: 'Recurrente', status: 'active', created_at: '2026-01-09T17:25:00Z', purchase_count: 12, total_purchased: 980.4 },
  { id: 6, document_type: 'DNI', document_number: '41902365', name: 'Ana Torres', email: 'ana.torres@correo.com', phone: '+51966778899', address: 'Jr. Bolognesi 118, Arequipa', segment: 'Recurrente', status: 'active', created_at: '2025-12-30T11:45:00Z', purchase_count: 15, total_purchased: 1310.75 },
  { id: 7, document_type: 'DNI', document_number: '75612348', name: 'Luis Ríos', email: 'luis.rios@correo.com', phone: '+51933221144', address: 'Av. Túpac Amaru 3050, Lima', segment: 'Ocasional', status: 'active', created_at: '2026-04-03T08:30:00Z', purchase_count: 5, total_purchased: 412.0 },
  { id: 8, document_type: 'DNI', document_number: '48756123', name: 'Carmen Vega', email: 'carmen.vega@correo.com', phone: '+51977665544', address: 'Calle Tacna 234, Juliaca', segment: 'Recurrente', status: 'active', created_at: '2026-02-14T14:20:00Z', purchase_count: 21, total_purchased: 1875.3 },
  { id: 9, document_type: 'DNI', document_number: '70125634', name: 'Pedro Salazar', email: 'pedro.salazar@correo.com', phone: '+51911223344', address: 'Av. Brasil 1450, Jesús María', segment: 'Nuevo', status: 'active', created_at: '2026-07-12T10:10:00Z', purchase_count: 1, total_purchased: 79.9 },
  { id: 10, document_type: 'RUC', document_number: '20601234567', name: 'Distribuidora Sur E.I.R.L.', email: 'contacto@distrisur.pe', phone: '+51988445566', address: 'Av. Ejército 780, Arequipa', segment: 'Frecuente', status: 'active', created_at: '2025-10-05T16:00:00Z', purchase_count: 37, total_purchased: 9640.2 },
  { id: 11, document_type: 'DNI', document_number: '61234598', name: 'Rosa Huamán', email: 'rosa.huaman@correo.com', phone: '+51944556677', address: 'Jr. Huánuco 302, Huancayo', segment: 'Recurrente', status: 'active', created_at: '2026-03-27T13:35:00Z', purchase_count: 9, total_purchased: 725.6 },
  { id: 12, document_type: 'DNI', document_number: '73456128', name: 'Miguel Castro', email: 'miguel.castro@correo.com', phone: '+51955332211', address: 'Av. Pardo 501, Miraflores', segment: 'Ocasional', status: 'active', created_at: '2026-05-16T09:50:00Z', purchase_count: 4, total_purchased: 318.5 },
  { id: 13, document_type: 'DNI', document_number: '47856231', name: 'Fernanda Rojas', email: 'fernanda.rojas@correo.com', phone: '+51966887755', address: 'Calle Independencia 89, Trujillo', segment: 'Recurrente', status: 'active', created_at: '2026-01-25T15:05:00Z', purchase_count: 14, total_purchased: 1122.9 },
  { id: 14, document_type: 'DNI', document_number: '75012369', name: 'Diego Mendoza', email: 'diego.mendoza@correo.com', phone: '+51977223344', address: 'Av. San Martín 1220, Trujillo', segment: 'Nuevo', status: 'active', created_at: '2026-08-02T11:15:00Z', purchase_count: 3, total_purchased: 260.4 },
  { id: 15, document_type: 'CE', document_number: '00124587', name: 'Valeria Cruz', email: 'valeria.cruz@correo.com', phone: '+51988990011', address: 'Av. La Marina 2100, Lima', segment: 'Ocasional', status: 'active', created_at: '2026-06-08T18:40:00Z', purchase_count: 6, total_purchased: 540.0 },
  { id: 16, document_type: 'DNI', document_number: '43658712', name: 'José Ninahuanca', email: 'jose.ninahuanca@correo.com', phone: '+51911556677', address: 'Jr. Camaná 455, Cercado, Lima', segment: 'Recurrente', status: 'active', created_at: '2025-12-11T10:30:00Z', purchase_count: 23, total_purchased: 2040.15 },
  { id: 17, document_type: 'DNI', document_number: '76540123', name: 'Gabriela Paredes', email: 'gabriela.paredes@correo.com', phone: '+51933778899', address: 'Av. Petit Thouars 5400, Lima', segment: 'Nuevo', status: 'active', created_at: '2026-08-21T14:55:00Z', purchase_count: 1, total_purchased: 59.9 },
  { id: 18, document_type: 'DNI', document_number: '40125638', name: 'Roberto Chávez', email: 'roberto.chavez@correo.com', phone: '+51966112233', address: 'Av. Piérola 310, Ica', segment: 'Recurrente', status: 'active', created_at: '2026-02-02T12:25:00Z', purchase_count: 17, total_purchased: 1398.6 },
  { id: 19, document_type: 'DNI', document_number: '75863214', name: 'Sofía Aguilar', email: 'sofia.aguilar@correo.com', phone: '+51944889900', address: 'Calle Schell 456, Chiclayo', segment: 'Ocasional', status: 'inactive', created_at: '2025-11-27T16:10:00Z', purchase_count: 7, total_purchased: 486.7 },
  { id: 20, document_type: 'DNI', document_number: '48236519', name: 'Marco Villanueva', email: 'marco.villanueva@correo.com', phone: '+51955998877', address: 'Av. Grau 780, Piura', segment: 'Recurrente', status: 'active', created_at: '2026-04-19T09:05:00Z', purchase_count: 11, total_purchased: 865.2 },
  { id: 21, document_type: 'DNI', document_number: '74568912', name: 'Patricia León', email: 'patricia.leon@correo.com', phone: '+51977445566', address: 'Jr. Ancash 320, Cercado, Lima', segment: 'Recurrente', status: 'active', created_at: '2026-05-30T17:45:00Z', purchase_count: 13, total_purchased: 1052.3 },
  { id: 22, document_type: 'DNI', document_number: '62345789', name: 'Andrés Aguayo', email: 'andres.aguayo@correo.com', phone: '+51911667788', address: 'Av. Universitaria 1200, Lima', segment: 'Nuevo', status: 'active', created_at: '2026-09-01T08:20:00Z', purchase_count: 2, total_purchased: 132.0 },
  { id: 23, document_type: 'DNI', document_number: '45678123', name: 'Elena Quispe', email: 'elena.quispe@correo.com', phone: '+51966223344', address: 'Av. El Sol 945, Cusco', segment: 'Ocasional', status: 'inactive', created_at: '2025-10-14T13:00:00Z', purchase_count: 5, total_purchased: 392.5 },
  { id: 24, document_type: 'DNI', document_number: '73985412', name: 'Ricardo Soto', email: 'ricardo.soto@correo.com', phone: '+51988556677', address: 'Av. Argentina 1250, Callao', segment: 'Recurrente', status: 'inactive', created_at: '2026-01-17T11:30:00Z', purchase_count: 8, total_purchased: 610.9 },
]

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

type ItemSpec = [productId: number, quantity: number, unitPrice: number, discount: number]

/** Construye una venta de demostración con sus totales calculados. */
function buildSale(
  id: number,
  customerId: number,
  sellerId: number,
  issuedAt: string,
  status: SaleStatus,
  itemSpecs: ItemSpec[],
  paidRatio: number,
): Sale {
  const customer = { id: customerId, name: SEED_CUSTOMERS.find((entry) => entry.id === customerId)?.name ?? 'Cliente' }
  const seller = { id: sellerId, name: SELLERS.find((entry) => entry.id === sellerId)?.name ?? 'Vendedor' }
  const items: SaleItem[] = itemSpecs.map(([productId, quantity, unitPrice, discount]) => {
    const product = SEED_PRODUCTS.find((entry) => entry.id === productId) ?? SEED_PRODUCTS[0]
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
  const totals = computeTotals(items, DEFAULT_TAX_RATE)
  const paid = round2(totals.total * paidRatio)
  return {
    id,
    sale_number: `V-2026-${String(1000 + id).padStart(6, '0')}`,
    customer,
    seller,
    issued_at: issuedAt,
    status,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    paid,
    balance: round2(totals.total - paid),
    cancelled_at: null,
    cancel_reason: null,
  }
}

/**
 * Ventas de demostración repartidas en los últimos 12 meses para que
 * los gráficos de evolución, las medias y los insights tengan historial real.
 */
const SEED_SALES: Sale[] = [
  buildSale(1, 1, 3, '2025-10-08T10:15:00Z', 'paid', [[1, 6, 5.0, 0], [4, 2, 18.5, 0]], 1),
  buildSale(2, 2, 4, '2025-10-21T16:40:00Z', 'paid', [[2, 3, 3.0, 0], [5, 4, 4.8, 2]], 1),
  buildSale(3, 3, 3, '2025-11-04T11:05:00Z', 'partial', [[12, 1, 12.5, 0], [16, 6, 4.9, 0]], 0.5),
  buildSale(4, 4, 2, '2025-11-19T09:20:00Z', 'paid', [[1, 6, 5.0, 0], [2, 3, 3.0, 0]], 1),
  buildSale(5, 5, 4, '2025-12-02T15:30:00Z', 'pending', [[4, 2, 18.5, 0], [18, 1, 16.9, 0]], 0),
  buildSale(6, 6, 2, '2025-12-15T12:00:00Z', 'paid', [[5, 4, 4.8, 2], [16, 6, 4.9, 0]], 1),
  buildSale(7, 7, 3, '2026-01-09T10:45:00Z', 'cancelled', [[1, 6, 5.0, 0], [8, 2, 4.0, 0]], 0),
  buildSale(8, 8, 4, '2026-01-23T14:10:00Z', 'paid', [[12, 1, 12.5, 0], [18, 1, 16.9, 0]], 1),
  buildSale(9, 2, 2, '2026-02-11T08:50:00Z', 'paid', [[1, 6, 5.0, 0], [4, 2, 18.5, 0], [16, 6, 4.9, 0]], 1),
  buildSale(10, 3, 3, '2026-03-06T17:25:00Z', 'partial', [[2, 3, 3.0, 0], [5, 4, 4.8, 2]], 0.4),
  buildSale(11, 5, 4, '2026-04-17T13:15:00Z', 'paid', [[8, 2, 4.0, 0], [12, 1, 12.5, 0]], 1),
  buildSale(12, 1, 2, '2026-05-22T09:30:00Z', 'paid', [[18, 1, 16.9, 0]], 1),
  buildSale(13, 4, 3, '2026-06-13T18:05:00Z', 'paid', [[4, 2, 18.5, 0], [15, 3, 5.5, 0]], 1),
  buildSale(14, 7, 4, '2026-07-24T11:45:00Z', 'paid', [[1, 6, 5.0, 0], [16, 6, 4.9, 0], [5, 4, 4.8, 0]], 1),
  buildSale(15, 8, 2, '2026-08-28T15:20:00Z', 'pending', [[12, 1, 12.5, 0], [7, 2, 9.2, 0]], 0),
  buildSale(16, 3, 3, '2026-09-12T10:05:00Z', 'paid', [[4, 2, 18.5, 0], [16, 6, 4.9, 0], [8, 2, 4.0, 0]], 1),
]

const SEED_MOVEMENTS = [
  { id: 88, product_id: 1, sku: 'SKU-0001', type: 'IN' as const, quantity: 48, resulting_stock: 96, reason: 'Recepción de compra OC-0042', user: SELLERS[0], created_at: '2026-09-30T16:00:00Z' },
  { id: 87, product_id: 11, sku: 'SKU-0011', type: 'SHRINKAGE' as const, quantity: 6, resulting_stock: 0, reason: 'Merma por productos dañados', user: SELLERS[2], created_at: '2026-09-30T11:20:00Z' },
  { id: 86, product_id: 17, sku: 'SKU-0017', type: 'OUT' as const, quantity: 4, resulting_stock: 8, reason: 'Venta en mostrador', user: SELLERS[1], created_at: '2026-09-29T18:05:00Z' },
  { id: 85, product_id: 5, sku: 'SKU-0005', type: 'IN' as const, quantity: 30, resulting_stock: 80, reason: 'Recepción de compra OC-0039', user: SELLERS[0], created_at: '2026-09-29T10:40:00Z' },
  { id: 84, product_id: 9, sku: 'SKU-0009', type: 'ADJUSTMENT' as const, quantity: 2, resulting_stock: 12, reason: 'Ajuste por conteo físico', user: SELLERS[2], created_at: '2026-09-28T17:15:00Z' },
  { id: 83, product_id: 3, sku: 'SKU-0003', type: 'OUT' as const, quantity: 6, resulting_stock: 18, reason: 'Venta en mostrador', user: SELLERS[1], created_at: '2026-09-28T09:30:00Z' },
  { id: 82, product_id: 12, sku: 'SKU-0012', type: 'RETURN' as const, quantity: 2, resulting_stock: 30, reason: 'Devolución de cliente', user: SELLERS[0], created_at: '2026-09-27T15:50:00Z' },
  { id: 81, product_id: 6, sku: 'SKU-0006', type: 'OUT' as const, quantity: 8, resulting_stock: 22, reason: 'Venta en mostrador', user: SELLERS[1], created_at: '2026-09-26T12:10:00Z' },
]

export interface SeedState {
  categories: Category[]
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  sellers: Seller[]
  movements: InventoryMovement[]
}

/** Estado inicial en memoria (copia profunda para poder resetear). */
export function createSeedState(): SeedState {
  return {
    categories: CATEGORIES.map((category) => ({ ...category })),
    sellers: SELLERS.map((seller) => ({ ...seller })),
    products: SEED_PRODUCTS.map((seed) => {
      const category = CATEGORIES.find((entry) => entry.id === seed.category_id) ?? CATEGORIES[0]
      return { ...seed, category: { id: category.id, name: category.name } }
    }),
    customers: SEED_CUSTOMERS.map((seed) => ({ ...seed })),
    sales: SEED_SALES.map((sale) => ({ ...sale, items: sale.items.map((item) => ({ ...item })) })),
    movements: SEED_MOVEMENTS.map((movement) => ({ ...movement, user: { ...movement.user } })),
  }
}
