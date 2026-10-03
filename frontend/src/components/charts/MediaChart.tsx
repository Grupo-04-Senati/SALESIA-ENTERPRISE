import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/utils/formatters'
import { CHART_GRID } from '@/data/analytics'

/**
 * MediaChart del sistema de diseño (txt §6.2): línea de tickets con la
 * media aritmética marcada en azul corporativo #1E3A8A.
 */

interface MediaChartProps {
  /** Tickets ordenados de menor a mayor. */
  values: number[]
}

export default function MediaChart({ values }: MediaChartProps) {
  const sorted = [...values].sort((a, b) => a - b)
  const value = sorted.length > 0 ? sorted.reduce((sum, item) => sum + item, 0) / sorted.length : 0
  const data = sorted.map((ticket, index) => ({ index: index + 1, ticket }))

  return (
    <div className="h-40">
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
  )
}
