import { Link } from 'react-router-dom'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { mean } from '../services/statisticsService'
import MediaChart from '@/components/charts/MediaChart'
import { EmptyState } from '@/components/feedback/EmptyState'

/**
 * Panel de la media aritmética (Fase 09 · RF-11).
 * MeanChart del sistema de diseño: línea #1E3A8A (txt §6.2).
 */

interface MeanPanelProps {
  values: number[]
}

export default function MeanPanel({ values }: MeanPanelProps) {
  if (values.length === 0) {
    return (
      <div className="card">
        <h3 className="text-h4 text-gray-800">Media aritmética</h3>
        <EmptyState
          title="Sin ventas en el periodo"
          description="La media se calcula con los tickets reales. Registra ventas para verla."
          action={
            <Link to="/ventas" className="btn-primary">
              Registrar venta
            </Link>
          }
        />
      </div>
    )
  }

  const value = mean(values)

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">Media aritmética</h3>
      <p className="mt-1 text-kpi font-bold text-primary">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        Suma de {formatNumber(values.length)} tickets dividido entre {formatNumber(values.length)}.
      </p>

      <div className="mt-4">
        <MediaChart values={values} />
      </div>
      <p className="mt-2 text-caption text-gray-500">
        Eje de datos: <span className="text-gray-500">#6B7280</span> · media marcada en azul corporativo.
      </p>
    </div>
  )
}
