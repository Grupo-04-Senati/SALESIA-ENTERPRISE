import type { Sale } from '@/types/sale'
import { getState, isLowStock, ruleEnabled, ruleNumber } from './store'
import type { StoreState } from './store'

/**
 * Analítica derivada del almacén (Fase 10 · RF-09…RF-14).
 * Todos los indicadores se calculan a partir de las ventas, productos y
 * clientes reales del sistema: si se registra una venta, estos números
 * cambian automáticamente.
 */

export const CHART_COLORS = [
  '#1E3A8A',
  '#06B6D4',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
] as const

export const CHART_GRID = '#E5E7EB'
export const CHART_AXIS = '#6B7280'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const round2 = (value: number): number => Math.round(value * 100) / 100

export type PeriodMonths = 3 | 6 | 12

export interface AnalyticsFilters {
  months: PeriodMonths
  seller: string
  category: string
}

export const DEFAULT_FILTERS: AnalyticsFilters = { months: 12, seller: '', category: '' }

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** Ventas del periodo y filtros indicados (excluye anuladas de los ingresos). */
export function selectSales(filters: Partial<AnalyticsFilters> = {}): Sale[] {
  const state = getState()
  const { months = 12, seller = '', category = '' } = filters
  const since = new Date()
  since.setDate(1)
  since.setMonth(since.getMonth() - (months - 1))

  return state.sales
    .filter((sale) => {
      if (new Date(sale.issued_at) < since) return false
      if (seller && sale.seller.name !== seller) return false
      if (category) {
        const productIds = new Set(
          state.products.filter((product) => product.category.name === category).map((product) => product.id),
        )
        if (!sale.items.some((item) => productIds.has(item.product_id))) return false
      }
      return true
    })
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
}

/** Ventas que suman a los ingresos (las anuladas no). */
const valid = (sales: Sale[]): Sale[] => sales.filter((sale) => sale.status !== 'cancelled')

export interface Kpis {
  ingresos: number
  transacciones: number
  ticketPromedio: number
  variacionMensual: number
}

export function getKpis(filters: Partial<AnalyticsFilters> = {}): Kpis {
  const sales = valid(selectSales(filters))
  const ingresos = round2(sales.reduce((total, sale) => total + sale.total, 0))
  const transacciones = sales.length
  const months = monthBuckets(filters.months ?? 12)
  const last = months[months.length - 1]
  const previous = months[months.length - 2]
  const ingresosMes = (key: string): number =>
    round2(
      sales
        .filter((sale) => monthKey(new Date(sale.issued_at)) === key)
        .reduce((total, sale) => total + sale.total, 0),
    )
  const lastValue = last ? ingresosMes(last.key) : 0
  const previousValue = previous ? ingresosMes(previous.key) : 0

  return {
    ingresos,
    transacciones,
    ticketPromedio: transacciones > 0 ? round2(ingresos / transacciones) : 0,
    variacionMensual: previousValue > 0 ? round2(((lastValue - previousValue) / previousValue) * 100) : 0,
  }
}

interface MonthBucket {
  key: string
  label: string
}

/** Últimos N meses, del más antiguo al más reciente. */
function monthBuckets(count: number): MonthBucket[] {
  const buckets: MonthBucket[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(cursor)
    date.setMonth(cursor.getMonth() - index)
    buckets.push({
      key: monthKey(date),
      label: `${MONTH_NAMES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`,
    })
  }
  return buckets
}

export interface MonthlyPoint {
  mes: string
  ingresos: number
  transacciones: number
}

export function getMonthly(filters: Partial<AnalyticsFilters> = {}): MonthlyPoint[] {
  const sales = valid(selectSales(filters))
  return monthBuckets(filters.months ?? 12).map((bucket) => {
    const monthly = sales.filter((sale) => monthKey(new Date(sale.issued_at)) === bucket.key)
    return {
      mes: bucket.label,
      ingresos: round2(monthly.reduce((total, sale) => total + sale.total, 0)),
      transacciones: monthly.length,
    }
  })
}

export interface ProductPoint {
  name: string
  ingresos: number
  unidades: number
}

export function getByProduct(filters: Partial<AnalyticsFilters> = {}): ProductPoint[] {
  const state: StoreState = getState()
  const sales = valid(selectSales(filters))
  const totals = new Map<number, { ingresos: number; unidades: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const current = totals.get(item.product_id) ?? { ingresos: 0, unidades: 0 }
      current.ingresos += item.quantity * item.unit_price - item.discount
      current.unidades += item.quantity
      totals.set(item.product_id, current)
    }
  }
  return [...totals.entries()]
    .map(([productId, value]) => {
      const product = state.products.find((entry) => entry.id === productId)
      return { name: product?.name ?? `Producto ${productId}`, ingresos: round2(value.ingresos), unidades: value.unidades }
    })
    .sort((a, b) => b.ingresos - a.ingresos)
}

export interface SellerPoint {
  name: string
  ingresos: number
  ventas: number
}

export function getBySeller(filters: Partial<AnalyticsFilters> = {}): SellerPoint[] {
  const sales = valid(selectSales(filters))
  return getState()
    .sellers.filter((seller) => !filters.seller || seller.name === filters.seller)
    .map((seller) => {
      const propias = sales.filter((sale) => sale.seller.id === seller.id)
      return {
        name: seller.name,
        ingresos: round2(propias.reduce((total, sale) => total + sale.total, 0)),
        ventas: propias.length,
      }
    })
    .filter((seller) => seller.ventas > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
}

export interface CategoryPoint {
  name: string
  ingresos: number
  color: string
}

export function getByCategory(filters: Partial<AnalyticsFilters> = {}): CategoryPoint[] {
  const state = getState()
  const sales = valid(selectSales({ ...filters, category: '' }))
  return state.categories
    .filter((category) => !filters.category || category.name === filters.category)
    .map((category, index) => {
      const productIds = new Set(
        state.products.filter((product) => product.category.id === category.id).map((product) => product.id),
      )
      const ingresos = sales
        .filter((sale) => sale.items.some((item) => productIds.has(item.product_id)))
        .reduce((total, sale) => {
          const lineas = sale.items.filter((item) => productIds.has(item.product_id))
          const subtotal = lineas.reduce((sum, item) => sum + item.quantity * item.unit_price - item.discount, 0)
          return total + subtotal
        }, 0)
      return {
        name: category.name,
        ingresos: round2(ingresos),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }
    })
    .filter((category) => category.ingresos > 0)
    .sort((a, b) => b.ingresos - a.ingresos)
}

export interface DistributionBin {
  rango: string
  frecuencia: number
}

const RANGES: Array<{ label: string; min: number; max: number }> = [
  { label: '0–50', min: 0, max: 50 },
  { label: '50–100', min: 50, max: 100 },
  { label: '100–150', min: 100, max: 150 },
  { label: '150–200', min: 150, max: 200 },
  { label: '200–300', min: 200, max: 300 },
  { label: '300–400', min: 300, max: 400 },
  { label: '400+', min: 400, max: Number.POSITIVE_INFINITY },
]

/** Distribución de frequencies por rango de ticket (histograma §6.2). */
export function getDistribution(filters: Partial<AnalyticsFilters> = {}): DistributionBin[] {
  const tickets = getTicketDataset(filters)
  return RANGES.map((range) => ({
    rango: range.label,
    frecuencia: tickets.filter((ticket) => ticket >= range.min && ticket < range.max).length,
  }))
}

/**
 * Dataset de tickets de venta para media, mediana y Bayes.
 * Devuelve solo tickets reales: con menos de 2 ventas el conjunto está
 * vacío y las vistas muestran su estado vacío (el módulo Probabilidad
 * avisa con la regla RN-40 cuando no hay datos suficientes).
 */
export function getTicketDataset(filters: Partial<AnalyticsFilters> = {}): number[] {
  return valid(selectSales(filters)).map((sale) => sale.total)
}

/* ------------------------------------------------------------------
   Estadística descriptiva (Semana 07 · RF-11, RF-12, RF-13)
   ------------------------------------------------------------------ */

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export interface CompareResult {
  mean: number
  median: number
  difference: number
  differencePct: number
  interpretation: string
}

export function compareMeanMedian(values: number[]): CompareResult {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      difference: 0,
      differencePct: 0,
      interpretation: 'analytics.interp-sin-ventas',
    }
  }
  const meanValue = mean(values)
  const medianValue = median(values)
  const difference = round2(meanValue - medianValue)
  const differencePct = medianValue > 0 ? round2((difference / medianValue) * 100) : 0
  let interpretation: string
  if (Math.abs(differencePct) < 5) {
    interpretation = 'analytics.interp-simetrica'
  } else if (difference > 0) {
    interpretation = 'analytics.interp-cola-derecha'
  } else {
    interpretation = 'analytics.interp-cola-izquierda'
  }
  return { mean: meanValue, median: medianValue, difference, differencePct, interpretation }
}

/** Nombres de vendedores y categorías para los filtros. */
export const getSellerNames = (): string[] => getState().sellers.map((seller) => seller.name)
export const getCategoryNames = (): string[] => getState().categories.map((category) => category.name)
export const getTopProductNames = (limit = 8): string[] =>
  getByProduct().slice(0, limit).map((product) => product.name)

/* ------------------------------------------------------------------
   Alertas automáticas del sistema
   Se calculan con las reglas configuradas en Automatizaciones y se
   muestran en Analytics (y en el resto de módulos) sin que nadie
   tenga que pedirlas.
   ------------------------------------------------------------------ */

export interface SystemAlert {
  id: string
  severity: 'info' | 'warning' | 'error'
  title: string
  detail: string
  module: 'inventario' | 'ventas' | 'analítica'
}

export function getSystemAlerts(filters: Partial<AnalyticsFilters> = {}): SystemAlert[] {
  const state = getState()
  const alerts: SystemAlert[] = []

  // Inventario: stock bajo o agotado (regla ALERTA_STOCK).
  const lowStock = state.products.filter((product) => isLowStock(product))
  const outOfStock = state.products.filter((product) => product.current_stock === 0)
  if (ruleEnabled('REG-07_STOCK_INSIGHT') && lowStock.length > 0) {
    alerts.push({
      id: 'stock',
      severity: outOfStock.length > 0 ? 'error' : 'warning',
      title:
        outOfStock.length > 0
          ? `${outOfStock.length} producto(s) sin stock`
          : `${lowStock.length} producto(s) en alerta de stock`,
      detail:
        outOfStock.length > 0
          ? `Agotados: ${outOfStock.map((p) => p.sku).join(', ')}. Revisa la reposición en Inventario.`
          : `SKU: ${lowStock.slice(0, 4).map((p) => p.sku).join(', ')}${lowStock.length > 4 ? '…' : ''}.`,
      module: 'inventario',
    })
  }

  // Ventas: cobranza pendiente (RF-07).
  const sales = valid(selectSales(filters))
  const pending = sales.filter((sale) => sale.status !== 'paid')
  const pendingAmount = round2(pending.reduce((total, sale) => total + sale.balance, 0))
  if (pending.length > 0) {
    alerts.push({
      id: 'cobranza',
      severity: pendingAmount > 300 ? 'warning' : 'info',
      title: `${pending.length} venta(s) con saldo pendiente`,
      detail: `Saldo por cobrar: S/ ${pendingAmount.toFixed(2)} (${pending.filter((s) => s.status === 'pending').length} sin registrar pago).`,
      module: 'ventas',
    })
  }

  // Analítica: concentración por vendedor (regla REG-03).
  const bySeller = getBySeller(filters)
  const total = bySeller.reduce((sum, seller) => sum + seller.ingresos, 0)
  const top = bySeller[0]
  const umbral = ruleNumber('REG-03_CONCENTRACION', 'umbral', 40)
  if (ruleEnabled('REG-03_CONCENTRACION') && top && total > 0) {
    const share = Math.round((top.ingresos / total) * 1000) / 10
    alerts.push({
      id: 'concentracion',
      severity: share >= umbral ? 'warning' : 'info',
      title: `${top.name} concentra el ${share}% de los ingresos`,
      detail:
        share >= umbral
          ? `Supera el umbral configurado del ${umbral}%. Considera repartir la cartera.`
          : `Dentro del umbral configurado del ${umbral}%.`,
      module: 'analítica',
    })
  }

  // Analítica: tendencia del último mes (regla REG-01).
  const monthly = getMonthly(filters)
  const last = monthly[monthly.length - 1]
  const previous = monthly[monthly.length - 2]
  const margen = ruleNumber('REG-01_TENDENCIA', 'margen', 10)
  if (ruleEnabled('REG-01_TENDENCIA') && last && previous && previous.ingresos > 0) {
    const change = Math.round(((last.ingresos - previous.ingresos) / previous.ingresos) * 1000) / 10
    if (Math.abs(change) >= margen) {
      alerts.push({
        id: 'tendencia',
        severity: change < 0 ? 'warning' : 'info',
        title: `${change >= 0 ? 'Crecimiento' : 'Caída'} de ingresos del ${change >= 0 ? '' : '−'}${Math.abs(change)}%`,
        detail: `${last.mes}: S/ ${last.ingresos.toFixed(2)} frente a S/ ${previous.ingresos.toFixed(2)} en ${previous.mes}. Umbral de aviso ±${margen}%.`,
        module: 'analítica',
      })
    }
  }

  return alerts
}

/**
 * Escenario de Bayes construido con datos reales del negocio:
 * A = cliente recurrente · B = compra con ticket sobre el promedio.
 * Devuelve las probabilidades observadas; el posterior lo calcula el
 * módulo de Probabilidad (teorema de Bayes).
 */
export interface BusinessBayes {
  /** Probabilidad previa P(A): clientes recurrentes sobre el total. */
  prior: number
  /** Verosimilitud P(B|A): compras altas entre recurrentes. */
  likelihood: number
  /** Evidencia P(B): compras altas sobre el total. */
  evidence: number
  detalle: {
    recurrentes: number
    clientes: number
    ventasRecurrente: number
    comprasAltas: number
    ventasValidas: number
    comprasAltasRecurrente: number
    ticketPromedio: number
  }
}

export function getBusinessBayes(): BusinessBayes {
  const state = getState()
  const recurrentes = state.customers.filter(
    (customer) => customer.status === 'active' && ['Recurrente', 'Frecuente'].includes(customer.segment),
  )
  const clientes = state.customers.filter((customer) => customer.status === 'active')
  const ventas = state.sales.filter((sale) => sale.status !== 'cancelled')
  const ticketPromedio = ventas.length > 0 ? ventas.reduce((sum, sale) => sum + sale.total, 0) / ventas.length : 0

  const idsRecurrentes = new Set(recurrentes.map((customer) => customer.id))
  const ventasRecurrente = ventas.filter((sale) => idsRecurrentes.has(sale.customer.id))
  const comprasAltas = ventas.filter((sale) => sale.total > ticketPromedio)
  const comprasAltasRecurrente = comprasAltas.filter((sale) => idsRecurrentes.has(sale.customer.id))

  const ratio = (part: number, totalCount: number): number => (totalCount > 0 ? part / totalCount : 0)

  return {
    prior: round2(ratio(recurrentes.length, clientes.length)),
    likelihood: round2(ratio(comprasAltasRecurrente.length, ventasRecurrente.length)),
    evidence: round2(ratio(comprasAltas.length, ventas.length)),
    detalle: {
      recurrentes: recurrentes.length,
      clientes: clientes.length,
      ventasRecurrente: ventasRecurrente.length,
      comprasAltas: comprasAltas.length,
      ventasValidas: ventas.length,
      comprasAltasRecurrente: comprasAltasRecurrente.length,
      ticketPromedio: round2(ticketPromedio),
    },
  }
}

/* ------------------------------------------------------------------
   Probabilidad automática: conjuntos de datos y escenarios de Bayes
   calculados sobre la operación real, sin que el usuario escriba nada.
   ------------------------------------------------------------------ */

export interface StatisticalDataset {
  id: string
  label: string
  description: string
  unit: string
  values: number[]
}

/** Variables numéricas que el sistema analiza automáticamente. */
export function getStatisticalDatasets(filters: Partial<AnalyticsFilters> = {}): StatisticalDataset[] {
  const sales = valid(selectSales(filters))
  const lines = sales.flatMap((sale) => sale.items)
  return [
    {
      id: 'total',
      label: 'probability.ds-total-label',
      description: 'probability.ds-total-desc',
      unit: 'S/',
      values: sales.map((sale) => sale.total),
    },
    {
      id: 'cantidad',
      label: 'probability.ds-cantidad-label',
      description: 'probability.ds-cantidad-desc',
      unit: 'und',
      values: lines.map((item) => item.quantity),
    },
    {
      id: 'precio',
      label: 'probability.ds-precio-label',
      description: 'probability.ds-precio-desc',
      unit: 'S/',
      values: lines.map((item) => item.unit_price),
    },
    {
      id: 'subtotal',
      label: 'probability.ds-subtotal-label',
      description: 'probability.ds-subtotal-desc',
      unit: 'S/',
      values: lines.map((item) => item.quantity * item.unit_price - item.discount),
    },
    {
      id: 'descuento',
      label: 'probability.ds-descuento-label',
      description: 'probability.ds-descuento-desc',
      unit: 'S/',
      values: lines.map((item) => item.discount),
    },
  ]
}

export interface BayesScenario {
  id: string
  eventA: string
  eventB: string
  /** Nombre del vendedor líder (parámetro de la clave eventA). */
  seller?: string
  prior: number
  likelihood: number
  evidence: number
  detalle: {
    conA: number
    total: number
    conAyB: number
    conB: number
  }
  /** Clave i18n de la lectura (params: detalle). */
  lectura: string
}

/**
 * Escenarios de Bayes listos para aplicar: el sistema cuenta cuántos casos
 * hay de cada evento en la operación real y devuelve P(A), P(B|A) y P(B).
 */
export function getBayesScenarios(): BayesScenario[] {
  const state = getState()
  const ventas = state.sales.filter((sale) => sale.status !== 'cancelled')
  const total = ventas.length
  const ticketPromedio = total > 0 ? ventas.reduce((sum, sale) => sum + sale.total, 0) / total : 0
  const recurrentes = new Set(
    state.customers
      .filter((customer) => customer.status === 'active' && ['Recurrente', 'Frecuente'].includes(customer.segment))
      .map((customer) => customer.id),
  )
  const bebidas = new Set(
    state.products.filter((product) => product.category.name === 'Bebidas').map((product) => product.id),
  )
  const topSeller = [...new Set(ventas.map((sale) => sale.seller.name))].sort(
    (a, b) =>
      ventas.filter((sale) => sale.seller.name === b).length - ventas.filter((sale) => sale.seller.name === a).length,
  )[0]

  interface Definition {
    id: string
    eventA: string
    eventB: string
    isA: (sale: Sale) => boolean
    isB: (sale: Sale) => boolean
    lectura: (d: { conA: number; conAyB: number; conB: number }) => string
  }

  const definitions: Definition[] = [
    {
      id: 'recurrente-ticket',
      eventA: 'probability.evt-cliente-recurrente-o-frecuente',
      eventB: 'probability.evt-compra-con-ticket-sobre-el-promedio',
      isA: (sale) => recurrentes.has(sale.customer.id),
      isB: (sale) => sale.total > ticketPromedio,
      lectura: () => 'probability.lect-recurrente-ticket',
    },
    {
      id: 'vendedor-pagada',
      eventA: 'probability.evt-vendedor-con-mas-ventas',
      eventB: 'probability.evt-venta-totalmente-pagada',
      isA: (sale) => sale.seller.name === topSeller,
      isB: (sale) => sale.status === 'paid',
      lectura: () => 'probability.lect-vendedor-pagada',
    },
    {
      id: 'bebidas-descuento',
      eventA: 'probability.evt-venta-con-producto-de-bebidas',
      eventB: 'probability.evt-venta-que-recibio-descuento',
      isA: (sale) => sale.items.some((item) => bebidas.has(item.product_id)),
      isB: (sale) => sale.discount > 0,
      lectura: () => 'probability.lect-bebidas-descuento',
    },
    {
      id: 'multilinea',
      eventA: 'probability.evt-venta-de-una-sola-linea',
      eventB: 'probability.evt-venta-con-mas-de-2-lineas',
      isA: (sale) => sale.items.length === 1,
      isB: (sale) => sale.items.length > 2,
      lectura: (d) =>
        d.conAyB === 0 ? 'probability.lect-multilinea-una' : 'probability.lect-multilinea-varias',
    },
  ]

  const ratio = (part: number, totalCount: number): number => (totalCount > 0 ? round2(part / totalCount) : 0)

  return definitions.map((definition) => {
    const conA = ventas.filter(definition.isA).length
    const conB = ventas.filter(definition.isB).length
    const conAyB = ventas.filter((sale) => definition.isA(sale) && definition.isB(sale)).length
    return {
      id: definition.id,
      eventA: definition.eventA,
      eventB: definition.eventB,
      seller: topSeller ?? '—',
      prior: ratio(conA, total),
      likelihood: ratio(conAyB, conA),
      evidence: ratio(conB, total),
      detalle: { conA, total, conAyB, conB },
      lectura: definition.lectura({ conA, conAyB, conB }),
    }
  })
}

/**
 * Variables del sistema ya clasificadas (cualitativa / cuantitativa) con
 * sus frecuencias o estadísticos. No requiere que el usuario escriba datos.
 */
export function getSystemVariables(filters: Partial<AnalyticsFilters> = {}): Array<{
  name: string
  type: 'quantitative' | 'qualitative'
  subtype: string
  count: number
  mean?: number
  median?: number
  min?: number
  max?: number
  frequencies?: Array<{ value: string; count: number; pct: number }>
}> {
  const state = getState()
  const sales = valid(selectSales(filters))
  const lines = sales.flatMap((sale) => sale.items)
  const frequencies = (values: string[]): Array<{ value: string; count: number; pct: number }> => {
    const counts = new Map<string, number>()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count, pct: round2((count / values.length) * 100) }))
  }
  const quantitative = (name: string, values: number[]) => ({
    name,
    type: 'quantitative' as const,
    subtype:
      values.length === 0
        ? 'probability.subtipo-sin-datos'
        : values.every((value) => Number.isInteger(value))
          ? 'probability.subtipo-discreta'
          : 'probability.subtipo-continua',
    count: values.length,
    mean: values.length > 0 ? round2(mean(values)) : 0,
    median: values.length > 0 ? round2(median(values)) : 0,
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  })
  const qualitative = (name: string, values: string[]) => ({
    name,
    type: 'qualitative' as const,
    subtype: 'probability.subtipo-nominal',
    count: values.length,
    frequencies: frequencies(values),
  })

  return [
    quantitative('probability.var-total-venta', sales.map((sale) => sale.total)),
    quantitative('probability.var-subtotal-venta', sales.map((sale) => sale.subtotal)),
    quantitative('probability.var-impuesto-venta', sales.map((sale) => sale.tax)),
    quantitative('probability.var-cantidad-vendida-linea', lines.map((item) => item.quantity)),
    quantitative('probability.var-precio-unitario', lines.map((item) => item.unit_price)),
    qualitative('probability.var-categoria-producto', lines.map((item) => {
      const product = state.products.find((entry) => entry.id === item.product_id)
      return product?.category.name ?? 'probability.sin-categoria'
    })),
    qualitative('probability.var-vendedor', sales.map((sale) => sale.seller.name)),
    qualitative('probability.var-estado-venta', state.sales.map((sale) => sale.status)),
    qualitative('probability.var-segmento-cliente', sales.map((sale) => {
      const customer = state.customers.find((entry) => entry.id === sale.customer.id)
      return customer?.segment ?? 'probability.sin-segmento'
    })),
  ]
}
