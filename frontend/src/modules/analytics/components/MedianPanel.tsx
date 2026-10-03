import { Link } from 'react-router-dom'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { median } from '../services/statisticsService'
import MedianChart from '@/components/charts/MedianChart'
import { EmptyState } from '@/components/feedback/EmptyState'

/**
 * Panel de la mediana (Fase 09 · RF-12).
 * MedianChart del sistema de diseño: línea #06B6D4 (txt §6.2).
 */

interface MedianPanelProps {
  values: number[]
}

export default function MedianPanel({ values }: MedianPanelProps) {
  if (values.length === 0) {
    return (
      <div className="card">
        <h3 className="text-h4 text-gray-800">Mediana</h3>
        <EmptyState
          title="Sin ventas en el periodo"
          description="La mediana se calcula con los tickets reales. Registra ventas para verla."
          action={
            <Link to="/ventas" className="btn-primary">
              Registrar venta
            </Link>
          }
        />
      </div>
    )
  }

  const value = median(values)

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">Mediana</h3>
      <p className="mt-1 text-kpi font-bold text-accent">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        Valor central de {formatNumber(values.length)} tickets ordenados.
      </p>

      <div className="mt-4">
        <MedianChart values={values} />
      </div>
      <p className="mt-2 text-caption text-gray-500">Mediana marcada en cyan corporativo.</p>
    </div>
  )
}
