import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { CHART_GRID, median } from '../services/statisticsService'

/**
 * Panel de la mediana (Fase 09 · RF-12).
 * MedianChart del sistema de diseño: línea #06B6D4 (txt §6.2).
 */

interface MedianPanelProps {
  values: number[]
}

export default function MedianPanel({ values }: MedianPanelProps) {
  const value = median(values)
  const data = [...values]
    .sort((a, b) => a - b)
    .map((ticket, index) => ({ index: index + 1, ticket }))

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">Mediana</h3>
      <p className="mt-1 text-kpi font-bold text-accent">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        Valor central de {formatNumber(values.length)} tickets ordenados.
      </p>

      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" />
            <XAxis dataKey="index" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="ticket" stroke="#06B6D4" strokeWidth={2} dot={false} />
            <ReferenceLine y={value} stroke="#06B6D4" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-caption text-gray-500">Mediana marcada en cyan corporativo.</p>
    </div>
  )
}
