import type { Customer, CustomerInput } from '@/types/customer'
import type { Product, ProductInput } from '@/types/product'
import type { InventoryMovement, MovementType, Sale, SaleInput } from '@/types/sale'
import { DEFAULT_TAX_RATE, computeTotals, createSeedState } from './seed'
import type { SeedState } from './seed'
import { DEFAULT_RULES } from './rules'
import type { AutomationRule } from './rules'

/**
 * Almacén de datos en memoria — fuente única de verdad (Fase 03 · modo demo).
 *
 * Todos los módulos operan sobre este mismo estado: al registrar una venta,
 * el stock baja, se crea el movimiento en el kardex, se actualiza el historial
 * del cliente y quedan recalculados los KPI, insights y reportes. Cada
 * operación deja además una traza de pasos (RF trazabilidad, Fase 08) para
 * poder mostrar cómo funciona el proceso.
 *
 * TODO(Fase 05): sustituir por la API FastAPI + PostgreSQL (docs/05_api.md).
 */

export interface TraceStep {
  /** Módulo afectado: ventas · inventario · clientes · productos · analítica. */
  module: string
  label: string
  detail: string
}

export interface ProcessTrace {
  id: number
  at: string
  title: string
  steps: TraceStep[]
}

export interface StoreState extends SeedState {
  traces: ProcessTrace[]
  rules: AutomationRule[]
}

let state: StoreState = { ...createSeedState(), traces: [], rules: DEFAULT_RULES.map((rule) => ({ ...rule })) }
let traceId = 0

type Listener = () => void
const listeners = new Set<Listener>()

/** Suscripción a los cambios del almacén (usado por DataProvider). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function commit(): void {
  listeners.forEach((listener) => listener())
}

/** Estado actual (solo lectura). */
export function getState(): StoreState {
  return state
}

/**
 * Sustituye uno o varios fragmentos del estado con los datos reales de la
 * API (hidratación Fase 05). Lanza la suscripción para que las vistas
 * que leen del almacén se recalculen.
 */
export function hydrate(partial: Partial<SeedState>): void {
  state = { ...state, ...partial }
  commit()
}

/** Registra una traza de proceso devuelta por el backend (RF trazabilidad). */
export function logProcessTrace(title: string, steps: TraceStep[]): ProcessTrace {
  return logTrace(title, steps)
}

/** Trazas de los últimos procesos ejecutados. */
export function getTraces(): ProcessTrace[] {
  return state.traces
}

function logTrace(title: string, steps: TraceStep[]): ProcessTrace {
  const trace: ProcessTrace = { id: ++traceId, at: new Date().toISOString(), title, steps }
  state = { ...state, traces: [trace, ...state.traces].slice(0, 25) }
  return trace
}

/** Vacía el almacén y conserva las trazas y reglas activas. */
export function resetDemoData(): void {
  state = { ...createSeedState(), traces: state.traces, rules: state.rules }
  commit()
}

/* ------------------------------------------------------------------
   Automatizaciones: las reglas se configuran desde el frontend y se
   aplican en el momento, sin cambiar el código.
   ------------------------------------------------------------------ */

export function getRules(): AutomationRule[] {
  return state.rules
}

/** ¿Está activa una regla automática? */
export function ruleEnabled(code: string): boolean {
  return state.rules.find((rule) => rule.code === code)?.enabled ?? false
}

/** Valor de un parámetro de una regla. */
export function ruleParam(code: string, key: string): number | boolean | undefined {
  return state.rules.find((rule) => rule.code === code)?.params.find((param) => param.key === key)?.value
}

/** Valor numérico de un parámetro con valor por defecto. */
export function ruleNumber(code: string, key: string, fallback: number): number {
  const value = ruleParam(code, key)
  return typeof value === 'number' ? value : fallback
}

export function setRuleEnabled(code: string, enabled: boolean): void {
  state = {
    ...state,
    rules: state.rules.map((rule) => (rule.code === code ? { ...rule, enabled } : rule)),
  }
  commit()
}

export function setRuleParam(code: string, key: string, value: number | boolean): void {
  state = {
    ...state,
    rules: state.rules.map((rule) =>
      rule.code === code
        ? { ...rule, params: rule.params.map((param) => (param.key === key ? { ...param, value } : param)) }
        : rule,
    ),
  }
  commit()
}

/** Restaura las reglas a su configuración inicial. */
export function resetRules(): void {
  state = { ...state, rules: DEFAULT_RULES.map((rule) => ({ ...rule })) }
  commit()
}

/** ¿Un producto está en alerta de stock según la regla configurada? */
export function isLowStock(product: { current_stock: number; min_stock: number }): boolean {
  if (!ruleEnabled('ALERTA_STOCK')) return false
  const factor = ruleNumber('ALERTA_STOCK', 'factor', 100) / 100
  return product.current_stock <= product.min_stock * factor
}

const round2 = (value: number): number => Math.round(value * 100) / 100
const delay = (ms = 250): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const money = (value: number): string => `S/ ${round2(value).toFixed(2)}`

const nextId = (items: Array<{ id: number }>): number =>
  Math.max(...items.map((item) => item.id), 0) + 1

/* ------------------------------------------------------------------
   Productos
   ------------------------------------------------------------------ */

export async function insertProduct(input: ProductInput): Promise<Product> {
  await delay()
  if (ruleEnabled('RN-03_SKU_UNICO') && state.products.some((product) => product.sku === input.sku)) {
    throw new Error('Ya existe un producto con ese SKU (RN-03 · regla activa).')
  }
  if (ruleEnabled('RN-05_PRECIO_VENTA') && input.sale_price < input.cost_price) {
    throw new Error('El precio de venta no puede ser menor al costo (RN-05 · regla activa).')
  }
  const category = state.categories.find((entry) => entry.id === input.category_id) ?? state.categories[0]
  const product: Product = {
    id: nextId(state.products),
    ...input,
    category: { id: category.id, name: category.name },
    current_stock: 0,
    status: 'active',
    created_at: new Date().toISOString(),
  }
  state = { ...state, products: [...state.products, product] }
  commit()
  return product
}

export async function modifyProduct(id: number, input: ProductInput): Promise<Product> {
  await delay()
  if (
    ruleEnabled('RN-03_SKU_UNICO') &&
    state.products.some((product) => product.id !== id && product.sku === input.sku)
  ) {
    throw new Error('Ya existe un producto con ese SKU (RN-03 · regla activa).')
  }
  if (ruleEnabled('RN-05_PRECIO_VENTA') && input.sale_price < input.cost_price) {
    throw new Error('El precio de venta no puede ser menor al costo (RN-05 · regla activa).')
  }
  const existing = state.products.find((product) => product.id === id)
  if (!existing) throw new Error('Producto no encontrado.')
  const category = state.categories.find((entry) => entry.id === input.category_id) ?? state.categories[0]
  const updated: Product = { ...existing, ...input, category: { id: category.id, name: category.name } }
  state = { ...state, products: state.products.map((product) => (product.id === id ? updated : product)) }
  commit()
  return updated
}

export async function setProductStatus(id: number, status: Product['status']): Promise<Product> {
  await delay()
  const existing = state.products.find((product) => product.id === id)
  if (!existing) throw new Error('Producto no encontrado.')
  const updated: Product = { ...existing, status }
  state = { ...state, products: state.products.map((product) => (product.id === id ? updated : product)) }
  commit()
  return updated
}

/* ------------------------------------------------------------------
   Clientes
   ------------------------------------------------------------------ */

export async function insertCustomer(input: CustomerInput): Promise<Customer> {
  await delay()
  if (
    ruleEnabled('RN-01_DOCUMENTO_UNICO') &&
    state.customers.some((customer) => customer.document_number === input.document_number)
  ) {
    throw new Error('Ya existe un cliente con ese documento (RN-01 · regla activa).')
  }
  const customer: Customer = {
    id: nextId(state.customers),
    ...input,
    status: 'active',
    created_at: new Date().toISOString(),
    purchase_count: 0,
    total_purchased: 0,
  }
  state = { ...state, customers: [...state.customers, customer] }
  commit()
  return customer
}

export async function modifyCustomer(id: number, input: CustomerInput): Promise<Customer> {
  await delay()
  if (
    ruleEnabled('RN-01_DOCUMENTO_UNICO') &&
    state.customers.some((customer) => customer.id !== id && customer.document_number === input.document_number)
  ) {
    throw new Error('Ya existe un cliente con ese documento (RN-01 · regla activa).')
  }
  const existing = state.customers.find((customer) => customer.id === id)
  if (!existing) throw new Error('Cliente no encontrado.')
  const updated: Customer = { ...existing, ...input }
  state = { ...state, customers: state.customers.map((customer) => (customer.id === id ? updated : customer)) }
  commit()
  return updated
}

export async function setCustomerStatus(id: number, status: Customer['status']): Promise<Customer> {
  await delay()
  const existing = state.customers.find((customer) => customer.id === id)
  if (!existing) throw new Error('Cliente no encontrado.')
  const updated: Customer = { ...existing, status }
  state = { ...state, customers: state.customers.map((customer) => (customer.id === id ? updated : customer)) }
  commit()
  return updated
}

/* ------------------------------------------------------------------
   Inventario
   ------------------------------------------------------------------ */

const MOVEMENT_DELTA: Record<MovementType, 1 | -1> = {
  IN: 1,
  RETURN: 1,
  OUT: -1,
  SHRINKAGE: -1,
  ADJUSTMENT: -1,
}

function buildMovement(
  product: Product,
  type: MovementType,
  quantity: number,
  reason: string,
  userId: number,
  resultingStock: number,
): InventoryMovement {
  return {
    id: nextId(state.movements),
    product_id: product.id,
    sku: product.sku,
    type,
    quantity,
    resulting_stock: resultingStock,
    reason,
    user: state.sellers.find((seller) => seller.id === userId) ?? state.sellers[0],
    created_at: new Date().toISOString(),
  }
}

/** Aplica una variación de stock a un producto (RN-20: nunca negativo). */
function applyStock(productId: number, delta: number): Product {
  const product = state.products.find((entry) => entry.id === productId)
  if (!product) throw new Error('Producto no encontrado.')
  const nextStock = product.current_stock + delta
  if (ruleEnabled('RN-20_STOCK_NEGATIVO') && nextStock < 0) {
    throw new Error(`Stock insuficiente de ${product.name} (disponible: ${product.current_stock}).`)
  }
  const updated: Product = { ...product, current_stock: nextStock }
  state = { ...state, products: state.products.map((entry) => (entry.id === productId ? updated : entry)) }
  return updated
}

export interface MovementInput {
  product_id: number
  type: MovementType
  quantity: number
  reason: string
}

/** Entrada, salida, devolución, merma o ajuste (RF-08, RN-21). */
export async function insertMovement(input: MovementInput): Promise<{ movement: InventoryMovement; trace: ProcessTrace }> {
  await delay()
  const quantity = Math.abs(Math.trunc(input.quantity))
  if (quantity <= 0) throw new Error('La cantidad debe ser mayor a cero.')
  if (
    ruleEnabled('RN-21_MOTIVO_MERMA') &&
    (input.type === 'SHRINKAGE' || input.type === 'ADJUSTMENT') &&
    !input.reason.trim()
  ) {
    throw new Error('Ingresa el motivo del movimiento (obligatorio en merma y ajuste · RN-21).')
  }
  const product = state.products.find((entry) => entry.id === input.product_id)
  if (!product) throw new Error('Producto no encontrado.')

  const previousStock = product.current_stock
  const updated = applyStock(input.product_id, MOVEMENT_DELTA[input.type] * quantity)
  const movement = buildMovement(product, input.type, quantity, input.reason.trim() || 'Sin motivo', state.sellers[0].id, updated.current_stock)
  state = { ...state, movements: [movement, ...state.movements] }

  const trace = logTrace(`${movement.type} · ${product.name}`, [
    { module: 'inventario', label: 'Existencia actualizada', detail: `${product.sku}: ${previousStock} → ${updated.current_stock} ${product.unit}` },
    { module: 'inventario', label: 'Kardex registrado', detail: `${movement.type} de ${quantity} ${product.unit} — ${movement.reason}` },
    {
      module: 'analítica',
      label: 'Alertas recalculadas',
      detail: isLowStock(updated) ? `${product.name} está en alerta de stock` : 'Sin nuevas alertas',
    },
  ])
  commit()
  return { movement, trace }
}

/* ------------------------------------------------------------------
   Ventas — el proceso completo y su trazabilidad
   ------------------------------------------------------------------ */

export interface SaleProcessResult {
  sale: Sale
  trace: ProcessTrace
}

/**
 * Registra una venta y propaga el efecto a los demás módulos:
 * inventario (stock + kardex), clientes (historial) y analítica (KPIs).
 */
export async function insertSale(input: SaleInput): Promise<SaleProcessResult> {
  await delay()
  if (input.items.length === 0) throw new Error('Agrega al menos un producto a la venta.')

  // Validación de stock antes de tocar nada (RN-10, regla configurable).
  if (ruleEnabled('RN-10_STOCK_INSUFICIENTE')) {
    for (const item of input.items) {
      const product = state.products.find((entry) => entry.id === item.product_id)
      if (!product) throw new Error('Producto no encontrado en el catálogo.')
      if (item.quantity > product.current_stock) {
        throw new Error(`Stock insuficiente de ${product.name} (disponible: ${product.current_stock}).`)
      }
    }
  }

  const customer = state.customers.find((entry) => entry.id === input.customer_id)
  const seller = state.sellers.find((entry) => entry.id === input.seller_id)
  if (!customer) throw new Error('Cliente no válido.')
  if (!seller) throw new Error('Vendedor no válido.')

  // RN-11: tasa de impuesto configurable desde Automatizaciones.
  const taxRate = ruleEnabled('RN-11_TOTALES')
    ? ruleNumber('RN-11_TOTALES', 'taxRate', DEFAULT_TAX_RATE * 100) / 100
    : 0
  const totals = computeTotals(input.items, taxRate)
  // RN-16: el pago no puede exceder el total.
  if (ruleEnabled('RN-16_PAGO_MAXIMO') && input.payment.amount > totals.total) {
    throw new Error('El pago no puede superar el total de la venta.')
  }

  const id = nextId(state.sales)
  const paid = round2(input.payment.amount)
  const items = input.items.map((item) => {
    const product = state.products.find((entry) => entry.id === item.product_id)!
    return {
      ...item,
      sku: product.sku,
      name: product.name,
      subtotal: round2(item.quantity * item.unit_price - item.discount),
    }
  })

  const sale: Sale = {
    id,
    sale_number: `V-2026-${String(1000 + id).padStart(6, '0')}`,
    customer: { id: customer.id, name: customer.name },
    seller: { id: seller.id, name: seller.name },
    issued_at: new Date().toISOString(),
    status: paid >= totals.total ? 'paid' : paid > 0 ? 'partial' : 'pending',
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

  // 1) La venta entra en el historial.
  state = { ...state, sales: [sale, ...state.sales] }

  // 2) Inventario: baja de stock y kardex por cada línea (RF-08, regla configurable).
  const stockSteps: TraceStep[] = []
  if (ruleEnabled('RF-08_STOCK_AUTOMATICO')) {
    for (const item of items) {
      const before = state.products.find((entry) => entry.id === item.product_id)!.current_stock
      const updated = applyStock(item.product_id, -item.quantity)
      const movement = buildMovement(
        state.products.find((entry) => entry.id === item.product_id)!,
        'OUT',
        item.quantity,
        `Venta ${sale.sale_number}`,
        seller.id,
        updated.current_stock,
      )
      state = { ...state, movements: [movement, ...state.movements] }
      stockSteps.push({
        module: 'inventario',
        label: `${item.name} (${item.sku})`,
        detail: `stock ${before} → ${updated.current_stock} ${updated.unit} · kardex OUT registrado`,
      })
    }
  } else {
    stockSteps.push({
      module: 'inventario',
      label: 'Stock sin descontar',
      detail: 'La regla "Descontar stock y generar kardex" está desactivada en Automatizaciones.',
    })
  }

  // 3) Cliente: historial y total acumulado (RF-07, regla configurable).
  const updatedCustomer: Customer = {
    ...customer,
    purchase_count: customer.purchase_count + 1,
    total_purchased: round2(customer.total_purchased + sale.total),
  }
  if (ruleEnabled('RF-07_HISTORIAL_CLIENTE')) {
    state = {
      ...state,
      customers: state.customers.map((entry) => (entry.id === customer.id ? updatedCustomer : entry)),
    }
  }

  const traceSteps: TraceStep[] = [
    {
      module: 'ventas',
      label: 'Venta registrada',
      detail: `${items.length} línea(s) · total ${money(sale.total)} (IGV ${Math.round(taxRate * 100)}%) · estado ${sale.status}`,
    },
    ...stockSteps,
    ruleEnabled('RF-07_HISTORIAL_CLIENTE')
      ? {
          module: 'clientes',
          label: 'Historial del cliente',
          detail: `${customer.name}: ${customer.purchase_count} → ${updatedCustomer.purchase_count} compras (${money(updatedCustomer.total_purchased)})`,
        }
      : {
          module: 'clientes',
          label: 'Historial sin actualizar',
          detail: 'La regla "Actualizar historial del cliente" está desactivada en Automatizaciones.',
        },
  ]
  if (ruleEnabled('RF-09_INDICADORES')) {
    traceSteps.push({
      module: 'analítica',
      label: 'Indicadores recalculados',
      detail: 'Dashboard, Analytics, Insights y Reportes ya reflejan esta venta',
    })
  }

  const trace = logTrace(`Venta ${sale.sale_number}`, traceSteps)

  commit()
  return { sale, trace }
}
