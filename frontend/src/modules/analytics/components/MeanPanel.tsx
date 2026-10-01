import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID, mean } from '../services/statisticsService'

/**
 * Panel de la media aritmética (Fase 09 · RF-11).
 * MeanChart del sistema de diseño: línea #1E3A8A (txt §6.2).
 */

interface MeanPanelProps {
  values: number[]
}

export default function MeanPanel({ values }: MeanPanelProps) {
  const value = mean(values)
  const data = [...values]
    .sort((a, b) => a - b)
    .map((ticket, index) => ({ index: index + 1, ticket }))

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">Media aritmética</h3>
      <p className="mt-1 text-kpi font-bold text-primary">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        Suma de {formatNumber(values.length)} tickets dividido entre {formatNumber(values.length)}.
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
            <Line type="monotone" dataKey="ticket" stroke="#1E3A8A" strokeWidth={2} dot={false} />
            <ReferenceLine y={value} stroke="#1E3A8A" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-caption text-gray-500">
        Eje de datos: <span style={{ color: CHART_AXIS }}>#6B7280</span> · media marcada en azul corporativo.
      </p>
    </div>
  )
}
