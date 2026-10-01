/**
 * Servicio de analítica y estadística (Fase 10 · RF-09…RF-14).
 * Datos deterministas de demostración (misma forma que devolverá la API).
 * TODO(Fase 05): sustituir por `apiFetch` contra
 * GET /api/v1/dashboard/summary y /api/v1/statistics (docs/05_api.md).
 *
 * Paleta de gráficos (txt §6.1):
 * #1E3A8A · #06B6D4 · #3B82F6 · #10B981 · #F59E0B · #EF4444 · #8B5CF6 · #EC4899
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

export const SELLERS = ['Luis Ríos', 'Carlos Peña', 'Ana Torres'] as const

export const CATEGORIES = [
  'Bebidas',
  'Abarrotes',
  'Panadería',
  'Frutas y Verduras',
  'Limpieza',
  'Snacks',
  'Lácteos',
  'Cuidado personal',
] as const

export const TOP_PRODUCTS = [
  'Café molido 250g',
  'Leche entera 1L',
  'Gaseosa 500ml',
  'Detergente 1kg',
  'Shampoo 400ml',
  'Azúcar 1kg',
  'Queso fresco 500g',
  'Arroz premium 1kg',
] as const

export type PeriodMonths = 3 | 6 | 12

export interface AnalyticsFilters {
  months: PeriodMonths
  seller: string
  category: string
}

export const DEFAULT_FILTERS: AnalyticsFilters = { months: 12, seller: '', category: '' }

const MONTHS = [
  'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26',
  'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26',
]

/** Generador determinista: los datos no cambian entre recargas. */
function pseudo(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const SELLER_SHARE: Record<string, number> = { 'Luis Ríos': 0.42, 'Carlos Peña': 0.34, 'Ana Torres': 0.24 }

const CATEGORY_SHARE: Record<string, number> = {
  Bebidas: 0.22,
  Abarrotes: 0.19,
  Panadería: 0.11,
  'Frutas y Verduras': 0.09,
  Limpieza: 0.13,
  Snacks: 0.1,
  Lácteos: 0.1,
  'Cuidado personal': 0.06,
}

const baseMonthly = MONTHS.map((_, index) => 28000 + Math.round(pseudo(index + 1) * 14000))

function scale(value: number, filters: AnalyticsFilters): number {
  const sellerFactor = filters.seller ? SELLER_SHARE[filters.seller] ?? 0.33 : 1
  const categoryFactor = filters.category ? CATEGORY_SHARE[filters.category] ?? 0.15 : 1
  return Math.round(value * sellerFactor * categoryFactor)
}

export interface Kpis {
  ingresos: number
  transacciones: number
  ticketPromedio: number
  variacionMensual: number
}

export function getKpis(filters: AnalyticsFilters): Kpis {
  const slice = baseMonthly.slice(-filters.months)
  const ingresos = slice.reduce((total, value) => total + scale(value, filters), 0)
  const transacciones = Math.round(ingresos / 118.4)
  const last = scale(slice[slice.length - 1] ?? 0, filters)
  const previous = scale(slice[slice.length - 2] ?? last, filters)
  return {
    ingresos,
    transacciones,
    ticketPromedio: Math.round(ingresos / Math.max(transacciones, 1) * 100) / 100,
    variacionMensual: previous > 0 ? Math.round(((last - previous) / previous) * 1000) / 10 : 0,
  }
}

export interface MonthlyPoint {
  mes: string
  ingresos: number
  transacciones: number
}

export function getMonthly(filters: AnalyticsFilters): MonthlyPoint[] {
  return MONTHS.slice(-filters.months).map((mes, index) => {
    const ingresos = scale(baseMonthly[MONTHS.length - filters.months + index], filters)
    return { mes, ingresos, transacciones: Math.round(ingresos / 118.4) }
  })
}

export interface ProductPoint {
  name: string
  ingresos: number
  unidades: number
}

export function getByProduct(filters: AnalyticsFilters): ProductPoint[] {
  return TOP_PRODUCTS.map((name, index) => {
    const ingresos = scale(14000 - index * 1100, filters)
    return { name, ingresos, unidades: Math.round(ingresos / (6.5 + index * 0.4)) }
  })
}

export interface SellerPoint {
  name: string
  ingresos: number
  ventas: number
}

export function getBySeller(filters: AnalyticsFilters): SellerPoint[] {
  const total = getKpis({ ...filters, seller: '' }).ingresos
  return SELLERS.filter((name) => !filters.seller || filters.seller === name).map((name) => {
    const ingresos = Math.round(total * (SELLER_SHARE[name] ?? 0.33))
    return { name, ingresos, ventas: Math.round(ingresos / 118.4) }
  })
}

export interface CategoryPoint {
  name: string
  ingresos: number
  color: string
}

export function getByCategory(filters: AnalyticsFilters): CategoryPoint[] {
  const total = getKpis({ ...filters, category: '' }).ingresos
  return CATEGORIES.filter((name) => !filters.category || filters.category === name).map((name, index) => ({
    name,
    ingresos: Math.round(total * (CATEGORY_SHARE[name] ?? 0.12)),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

export interface DistributionBin {
  rango: string
  frecuencia: number
}

const RANGES = ['0–50', '50–100', '100–150', '150–200', '200–300', '300–400', '400+']

/** Histograma de ticket promedio (txt §6.2, color #3B82F6). */
export function getDistribution(filters: AnalyticsFilters): DistributionBin[] {
  const kpis = getKpis(filters)
  // Distribución aprox. alrededor del ticket promedio, recortada por filtros.
  const factor = filters.seller ? 0.55 : filters.category ? 0.7 : 1
  return RANGES.map((rango, index) => {
    const center = [25, 75, 125, 175, 250, 350, 480][index]
    const distance = Math.abs(center - kpis.ticketPromedio) / Math.max(kpis.ticketPromedio, 1)
    const frecuencia = Math.max(1, Math.round(180 * factor * Math.exp(-(distance * distance) * 2.2)))
    return { rango, frecuencia }
  })
}

/** Dataset de tickets para los cálculos estadísticos (media, mediana). */
export function getTicketDataset(filters: AnalyticsFilters): number[] {
  const kpis = getKpis(filters)
  const seedBase = filters.months + filters.seller.length + filters.category.length
  return Array.from({ length: 40 }, (_, index) => {
    const spread = pseudo(index + seedBase * 3) * 0.9 + 0.35
    return Math.round(kpis.ticketPromedio * spread * 100) / 100
  })
}

/* ------------------------------------------------------------------
   Estadística descriptiva — Semana 07 (RF-11, RF-12, RF-13)
   Se calculan en el frontend para replicar el backend (Fase 09/10)
   y dejar las vistas completas antes de la API.
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

/** Compara media y mediana con interpretación explicable (RF-13). */
export function compareMeanMedian(values: number[]): CompareResult {
  const meanValue = mean(values)
  const medianValue = median(values)
  const difference = Math.round((meanValue - medianValue) * 100) / 100
  const differencePct = medianValue > 0 ? Math.round((difference / medianValue) * 1000) / 10 : 0
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
