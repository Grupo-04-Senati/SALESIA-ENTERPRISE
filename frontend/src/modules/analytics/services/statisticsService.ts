/**
 * Servicio de analítica y estadística (Fase 10 · RF-09…RF-14).
 *
 * Los cálculos ya no usan datos sintéticos: se derivan del almacén
 * compartido (`src/data/store.ts`), de modo que cualquier venta,
 * movimiento o cliente registrado actualiza los indicadores
 * automáticamente.
 * TODO(Fase 05): sustituir por GET /api/v1/dashboard/summary y
 * /api/v1/statistics (docs/05_api.md §2.8).
 */

import { getState } from '@/data/store'

export {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  DEFAULT_FILTERS,
  compareMeanMedian,
  getByCategory,
  getByProduct,
  getBySeller,
  getDistribution,
  getKpis,
  getMonthly,
  getTicketDataset,
  mean,
  median,
} from '@/data/analytics'
export type {
  AnalyticsFilters,
  CategoryPoint,
  CompareResult,
  DistributionBin,
  Kpis,
  MonthlyPoint,
  PeriodMonths,
  ProductPoint,
  SellerPoint,
} from '@/data/analytics'

/** Vendedores disponibles para los filtros (docs/05_api.md §2.5). */
export function getSellerNames(): string[] {
  return getState().sellers.map((seller) => seller.name)
}

/** Categorías disponibles para los filtros (docs/05_api.md §2.4). */
export function getCategoryNames(): string[] {
  return getState().categories.map((category) => category.name)
}
