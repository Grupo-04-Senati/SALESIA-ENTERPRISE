import { useEffect, useState } from 'react'
import type { Insight } from '@/types/insight'
import { generateInsights } from '@/modules/insights/services/insightService'
import type { AnalyticsFilters } from '@/modules/analytics/services/statisticsService'
import { useDataVersion } from '@/data/DataProvider'

/**
 * Hook de datos de insights (Fase 06 — hooks de datos).
 * Regenera los insights cuando cambian los filtros o se pulsa recargar.
 * TODO(Fase 05): los consumirá GET /api/v1/insights.
 */
export function useInsights(filters: AnalyticsFilters) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const version = useDataVersion()

  const { months, seller, category } = filters

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    generateInsights({ months, seller, category })
      .then((result) => {
        if (!cancelled) setInsights(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron generar los insights')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [months, seller, category, attempt, version])

  return {
    insights,
    loading,
    error,
    reload: () => setAttempt((value) => value + 1),
  }
}
