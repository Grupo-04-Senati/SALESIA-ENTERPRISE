import { useMemo } from 'react'
import type { AnalyticsFilters } from '@/modules/analytics/services/statisticsService'
import { DEFAULT_FILTERS } from '@/data/analytics'
import {
  compareMeanMedian,
  getByCategory,
  getByProduct,
  getBySeller,
  getDistribution,
  getKpis,
  getMonthly,
  getTicketDataset,
} from '@/data/analytics'
import { useDataVersion } from '@/data/DataProvider'

/**
 * Hook de analítica (Fase 06 — hooks de datos).
 * Calcula los indicadores a partir del almacén compartido: en cuanto otro
 * módulo registra una venta o un movimiento, los gráficos se actualizan.
 * TODO(Fase 05): los datos definitivos llegarán del backend.
 */
export function useStatistics(filters: AnalyticsFilters = DEFAULT_FILTERS) {
  const version = useDataVersion()

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
    // `version` fuerza el recálculo cuando el almacén compartido cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.months, filters.seller, filters.category, version])
}
