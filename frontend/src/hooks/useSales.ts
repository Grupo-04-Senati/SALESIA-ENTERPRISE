import { useEffect, useState } from 'react'
import type { Sale, SaleStatus } from '@/types/sale'
import { listSales } from '@/modules/sales/services/saleService'
import type { SaleFilters } from '@/modules/sales/services/saleService'

/**
 * Hook de datos de ventas (Fase 06 — hooks de datos).
 * Encapsula carga, filtros, error y recarga.
 * TODO(Fase 05): el servicio ya habla con la API real.
 */
export function useSales(filters: SaleFilters = {}) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const { search = '', status = '' } = filters

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSales({ search, status: status as SaleStatus | '' })
      .then((result) => {
        if (!cancelled) setSales(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las ventas')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, status, attempt])

  return {
    sales,
    loading,
    error,
    reload: () => setAttempt((value) => value + 1),
  }
}
