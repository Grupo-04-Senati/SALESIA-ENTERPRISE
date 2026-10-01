import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID, compareMeanMedian } from '../services/statisticsService'

/**
 * Comparación media vs. mediana (Fase 09 · RF-13).
 * CompareChart del sistema de diseño: barras #1E3A8A y #06B6D4 (txt §6.2).
 */

interface ComparePanelProps {
  values: number[]
}

export default function ComparePanel({ values }: ComparePanelProps) {
  const result = compareMeanMedian(values)
  const data = [
    { name: 'Media', valor: Math.round(result.mean * 100) / 100 },
    { name: 'Mediana', valor: Math.round(result.median * 100) / 100 },
  ]

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">Media vs. mediana</h3>
      <p className="mt-1 text-caption text-gray-500">
        Diferencia: <span className="font-semibold text-gray-900">{formatCurrency(result.difference)}</span>{' '}
        ({formatPercent(result.differencePct / 100)})
      </p>

      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="valor" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
        {result.interpretation}
      </p>
    </div>
  )
}
