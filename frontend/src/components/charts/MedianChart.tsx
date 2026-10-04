import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/utils/formatters'
import { CHART_GRID } from '@/data/analytics'
import { useLang } from '@/i18n/i18n'

/**
 * MedianChart del sistema de diseño (txt §6.2): línea de tickets con la
 * mediana marcada en cyan corporativo #06B6D4.
 */

interface MedianChartProps {
  /** Tickets ordenados de menor a mayor. */
  values: number[]
}

export default function MedianChart({ values }: MedianChartProps) {
  const { t } = useLang()
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value =
    sorted.length === 0 ? 0 : sorted.length % 2 !== 0 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
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
          <Line type="monotone" dataKey="ticket" name={t('analytics.ticket')} stroke="#06B6D4" strokeWidth={2} dot={false} />
          <ReferenceLine y={value} stroke="#06B6D4" strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
