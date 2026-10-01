import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/form'
import { formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID } from '@/modules/analytics/services/statisticsService'
import { bayes } from '../services/probabilityService'
import type { BayesResult } from '@/types/statistics'

/**
 * Teorema de Bayes (Fase 09 · RF-15, RF-17).
 * BayesChart del sistema de diseño: barras #10B981 (txt §6.2).
 * Calcula P(A|B) = P(B|A)·P(A) / P(B) y muestra el paso a paso.
 */

interface BayesFormProps {
  /** Notifica el resultado para registrarlo en el historial (RF-21). */
  onResult?: (posterior: number) => void
}

export default function BayesForm({ onResult }: BayesFormProps) {
  const [prior, setPrior] = useState('0.40')
  const [likelihood, setLikelihood] = useState('0.80')
  const [evidence, setEvidence] = useState('0.45')
  const [result, setResult] = useState<BayesResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      const computed = bayes({
        prior: Number(prior),
        likelihood: Number(likelihood),
        evidence: Number(evidence),
      })
      setResult(computed)
      onResult?.(computed.posterior)
    } catch (reason: unknown) {
      setResult(null)
      setError(reason instanceof Error ? reason.message : 'No se pudo calcular')
    }
  }

  const chartData = result
    ? [
        { name: 'P(A) previa', valor: result.prior },
        { name: 'P(A|B) posterior', valor: result.posterior },
      ]
    : []

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="P(A) · probabilidad previa"
          type="number"
          min="0"
          max="1"
          step="0.01"
          inputMode="decimal"
          value={prior}
          onChange={(event) => setPrior(event.target.value)}
          hint="Entre 0 y 1"
        />
        <Input
          label="P(B|A) · verosimilitud"
          type="number"
          min="0"
          max="1"
          step="0.01"
          inputMode="decimal"
          value={likelihood}
          onChange={(event) => setLikelihood(event.target.value)}
          hint="Entre 0 y 1"
        />
        <Input
          label="P(B) · evidencia"
          type="number"
          min="0"
          max="1"
          step="0.01"
          inputMode="decimal"
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          hint="No puede ser 0 (RN-43)"
        />
      </div>

      <Button type="submit">Calcular posterior</Button>

      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-success bg-success-bg p-4">
          <p className="text-body-sm text-success-fg">
            P(A|B) = <span className="text-h3 font-bold">{formatPercent(result.posterior)}</span>
          </p>

          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 1]} />
                <Tooltip
                  formatter={(value) => formatPercent(Number(value))}
                  contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="valor" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ol className="space-y-1 text-caption text-success-fg">
            {result.steps.map((step) => (
              <li key={step}>• {step}</li>
            ))}
          </ol>
        </div>
      )}
    </form>
  )
}
