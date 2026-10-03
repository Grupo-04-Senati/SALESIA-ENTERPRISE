import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID } from '@/data/analytics'

/**
 * BayesChart: columnas de las probabilidades del teorema de Bayes
 * (previa, verosimilitud, evidencia y posterior en verde).
 */

interface BayesChartProps {
  prior: number
  likelihood: number
  evidence: number
  posterior: number
}

export default function BayesChart({ prior, likelihood, evidence, posterior }: BayesChartProps) {
  const data = [
    { name: 'P(A)', valor: prior },
    { name: 'P(B|A)', valor: likelihood },
    { name: 'P(B)', valor: evidence },
    { name: 'P(A|B)', valor: posterior },
  ]

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            formatter={(value) => formatPercent(Number(value))}
            contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="valor" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
