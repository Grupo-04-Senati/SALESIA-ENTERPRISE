import type { Sale } from '@/types/sale'
import { getState } from './store'
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
 * Con menos de 2 ventas se devuelve un conjunto de apoyo para que la vista
 * siga siendo utilizable (el módulo Probabilidad avisa cuando no hay datos
 * suficientes · RN-40).
 */
export function getTicketDataset(filters: Partial<AnalyticsFilters> = {}): number[] {
  const tickets = valid(selectSales(filters)).map((sale) => sale.total)
  if (tickets.length >= 2) return tickets
  const kpis = getKpis(filters)
  const base = kpis.ticketPromedio > 0 ? kpis.ticketPromedio : 120
  return [0.85, 0.95, 1, 1.1, 1.25].map((factor) => round2(base * factor))
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
  const meanValue = mean(values)
  const medianValue = median(values)
  const difference = round2(meanValue - medianValue)
  const differencePct = medianValue > 0 ? round2((difference / medianValue) * 100) : 0
  let interpretation: string
  if (Math.abs(differencePct) < 5) {
    interpretation = 'Media y mediana son muy parecidas: la distribución es casi simétrica.'
  } else if (difference > 0) {
    interpretation =
      'La media supera a la mediana: la distribución tiene cola derecha (algunas ventas muy altas elevan el promedio).'
  } else {
    interpretation =
      'La mediana supera a la media: la distribución tiene cola izquierda (las ventas pequeñas bajan el promedio).'
  }
  return { mean: meanValue, median: medianValue, difference, differencePct, interpretation }
}

/** Nombres de vendedores y categorías para los filtros. */
export const getSellerNames = (): string[] => getState().sellers.map((seller) => seller.name)
export const getCategoryNames = (): string[] => getState().categories.map((category) => category.name)
export const getTopProductNames = (limit = 8): string[] =>
  getByProduct().slice(0, limit).map((product) => product.name)
