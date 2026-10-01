import { useMemo } from 'react'
import {
  DEFAULT_FILTERS,
  compareMeanMedian,
  getByCategory,
  getByProduct,
  getBySeller,
  getDistribution,
  getKpis,
  getMonthly,
  getTicketDataset,
} from '@/modules/analytics/services/statisticsService'
import type { AnalyticsFilters } from '@/modules/analytics/services/statisticsService'

/**
 * Hook de datos de analítica (Fase 06 — hooks de datos).
 * Calcula y memoiza KPIs, series y estadísticas para los filtros activos.
 * TODO(Fase 05): los datos vienen del backend; aquí se calculan en memoria.
 */
export function useStatistics(filters: AnalyticsFilters = DEFAULT_FILTERS) {
  return useMemo(() => {
    const dataset = getTicketDataset(filters)
    return {
      kpis: getKpis(filters),
      monthly: getMonthly(filters),
      byProduct: getByProduct(filters),
      bySeller: getBySeller(filters),
      byCategory: getByCategory(filters),
      distribution: getDistribution(filters),
      dataset,
      compare: compareMeanMedian(dataset),
    }
  }, [filters])
}
