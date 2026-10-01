import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ListChecks, Percent } from 'lucide-react'
import Button from '@/components/ui/Button'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { Select } from '@/components/ui/form'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID, compareMeanMedian } from '@/data/analytics'
import {
  getBayesScenarios,
  getStatisticalDatasets,
  getSystemVariables,
} from '@/data/analytics'
import type { PeriodMonths } from '@/data/analytics'
import { useDataVersion } from '@/data/DataProvider'
import { bayes, listAnalyses, minObservations, registerAnalysis } from '../services/probabilityService'
import type { AnalysisRecord } from '@/types/statistics'

/**
 * Probabilidad y estadística — Semana 07 (Fase 09 · RF-11…RF-17, RF-21).
 *
 * Todo en esta vista es **automático**: el sistema toma las ventas, los
 * clientes y los productos registrados, clasifica las variables y calcula
 * media, mediana y el teorema de Bayes sin que se escriban datos. Cada
 * cambio en la operación vuelve a calcularlo todo.
 *
 * TODO(Fase 05): los cálculos se replicarán en el backend conservando la
 * misma trazabilidad (RN-40, RN-43, RF-21).
 */

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
]

export default function ProbabilityPage() {
  const [months, setMonths] = useState<PeriodMonths>(12)
  const [datasetId, setDatasetId] = useState('total')
  const [scenarioId, setScenarioId] = useState('recurrente-ticket')
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const version = useDataVersion()

  const filters = useMemo(() => ({ months, seller: '', category: '' }), [months])
  const datasets = useMemo(() => getStatisticalDatasets(filters), [filters, version])
  const scenarios = useMemo(() => getBayesScenarios(), [version])
  const variables = useMemo(() => getSystemVariables(filters), [filters, version])

  const dataset = datasets.find((entry) => entry.id === datasetId) ?? datasets[0]
  const scenario = scenarios.find((entry) => entry.id === scenarioId) ?? scenarios[0]

  const estadistico = useMemo(() => {
    if (!dataset || dataset.values.length < minObservations()) return null
    const compare = compareMeanMedian(dataset.values)
    const sorted = [...dataset.values].sort((a, b) => a - b)
    return {
      count: dataset.values.length,
      media: compare.mean,
      mediana: compare.median,
      minimo: sorted[0] ?? 0,
      maximo: sorted[sorted.length - 1] ?? 0,
      rango: (sorted[sorted.length - 1] ?? 0) - (sorted[0] ?? 0),
      interpretacion: compare.interpretation,
      diferencia: compare.difference,
      diferenciaPct: compare.differencePct,
    }
  }, [dataset, version])

  const posterior = useMemo(() => {
    if (!scenario) return null
    return bayes({ prior: scenario.prior, likelihood: scenario.likelihood, evidence: scenario.evidence })
  }, [scenario, version])

  /* Cada cálculo automático queda registrado en el historial (RF-21). */
  useEffect(() => {
    if (!estadistico || !posterior) return
    registerAnalysis({
      kind: 'media',
      label: `Media automática · ${dataset.label}`,
      result: formatCurrency(estadistico.media),
    })
    registerAnalysis({
      kind: 'mediana',
      label: `Mediana automática · ${dataset.label}`,
      result: formatCurrency(estadistico.mediana),
    })
    registerAnalysis({
      kind: 'comparacion',
      label: `Comparación automática · ${dataset.label}`,
      result: `Diferencia ${formatCurrency(Math.abs(estadistico.diferencia))} (${formatPercent(estadistico.diferenciaPct / 100)})`,
    })
    registerAnalysis({
      kind: 'bayes',
      label: `Bayes automático · ${scenario.eventA} → ${scenario.eventB}`,
      result: `P(A|B) = ${posterior.posterior}`,
    })
    setHistory(listAnalyses())
  }, [estadistico, posterior, dataset, scenario, version])

  const grafico = useMemo(
    () =>
      dataset
        ? [...dataset.values]
            .sort((a, b) => a - b)
            .map((value, index) => ({ index: index + 1, valor: value }))
        : [],
    [dataset, version],
  )

  const faltaDatos = !estadistico || !posterior

  return (
    <div className="space-y-6">
      <div>
        <h1>Probabilidad</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Media, mediana, teorema de Bayes y clasificación de variables calculados{' '}
          <span className="font-semibold text-primary">automáticamente</span> sobre los datos del
          sistema (Fase 09).
        </p>
      </div>

      {/* Filtros: eligen qué datos se analizan, sin escribirlos */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Select
          label="Periodo analizado"
          value={String(months)}
          onChange={(event) => setMonths(Number(event.target.value) as PeriodMonths)}
          className="md:w-52"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Variable numérica a analizar"
          value={dataset.id}
          onChange={(event) => setDatasetId(event.target.value)}
          className="md:w-64"
        >
          {datasets.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </Select>
        <Select
          label="Escenario de Bayes"
          value={scenario.id}
          onChange={(event) => setScenarioId(event.target.value)}
          className="md:w-72"
        >
          {scenarios.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.eventA} → {entry.eventB}
            </option>
          ))}
        </Select>
      </div>

      {faltaDatos ? (
        <div className="card">
          <p className="text-body-sm text-gray-600">
            La regla RN-40 exige al menos {minObservations()} observaciones y el periodo seleccionado
            no tiene suficientes datos. Amplía el periodo o registra más ventas en{' '}
            <Link to="/ventas" className="font-medium text-primary hover:underline">
              Ventas
            </Link>
            .
          </p>
        </div>
      ) : (
        estadistico &&
        posterior && (
        <>
          {/* Media y mediana automáticas */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity aria-hidden="true" className="h-5 w-5 text-primary" />
                <h2 className="text-h4 text-gray-800">Media y mediana automáticas</h2>
              </div>
              <span className="text-caption text-gray-500">{dataset.description}</span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Observaciones', value: formatNumber(estadistico.count) },
                { label: 'Media', value: formatCurrency(estadistico.media), tone: 'text-primary' },
                { label: 'Mediana', value: formatCurrency(estadistico.mediana), tone: 'text-accent' },
                { label: 'Mínimo', value: formatCurrency(estadistico.minimo) },
                { label: 'Máximo', value: formatCurrency(estadistico.maximo) },
                { label: 'Rango', value: formatCurrency(estadistico.rango) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-caption text-gray-500">{item.label}</dt>
                  <dd className={`text-body font-semibold text-gray-900 ${item.tone ?? ''}`}>{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                  <YAxis
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `${value.toFixed(0)}`}
                  />
                  <Tooltip
                    formatter={(value) => `${formatCurrency(Number(value))}`}
                    contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <ReferenceLine y={estadistico.media} stroke="#1E3A8A" strokeDasharray="4 4" />
                  <ReferenceLine y={estadistico.mediana} stroke="#06B6D4" strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
              Línea azul: media · línea cyan: mediana · {estadistico.interpretacion}
            </p>
          </section>

          {/* Bayes automático */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Percent aria-hidden="true" className="h-5 w-5 text-primary" />
                <h2 className="text-h4 text-gray-800">Teorema de Bayes automático</h2>
              </div>
              <span className="text-caption text-gray-500">
                A: {scenario.eventA} · B: {scenario.eventB}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-body-sm">
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">P(A) previa</span> · {scenario.detalle.conA} de{' '}
                  {scenario.detalle.total} ventas →{' '}
                  <span className="font-semibold text-primary">{formatPercent(scenario.prior)}</span>
                </p>
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">P(B|A) verosimilitud</span> · {scenario.detalle.conAyB}{' '}
                  casos de A con B →{' '}
                  <span className="font-semibold text-accent">{formatPercent(scenario.likelihood)}</span>
                </p>
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">P(B) evidencia</span> · {scenario.detalle.conB} de{' '}
                  {scenario.detalle.total} ventas →{' '}
                  <span className="font-semibold text-primary">{formatPercent(scenario.evidence)}</span>
                </p>
                <p className="rounded-md border border-success bg-success-bg px-3 py-2 text-success-fg">
                  <span className="font-semibold">P(A|B) posterior</span> ·{' '}
                  <span className="text-h4 font-bold">{formatPercent(posterior.posterior)}</span>
                  <span className="mt-1 block text-caption">
                    Probabilidad de que ocurra «{scenario.eventA}» sabiendo que «{scenario.eventB}».
                  </span>
                </p>
                <ol className="space-y-1 text-caption text-gray-600">
                  {posterior.steps.map((step) => (
                    <li key={step}>• {step}</li>
                  ))}
                  <li>• {scenario.lectura}</li>
                </ol>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'P(A)', valor: scenario.prior },
                      { name: 'P(B|A)', valor: scenario.likelihood },
                      { name: 'P(B)', valor: scenario.evidence },
                      { name: 'P(A|B)', valor: posterior.posterior },
                    ]}
                    margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                  >
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
            </div>
          </section>
        </>
        )
      )}

      {/* Clasificación automática de variables */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h3 text-gray-800">Clasificación automática de variables</h2>
          </div>
          <span className="text-caption text-gray-500">
            El sistema detecta cuáles variables son cuantitativas y cuáles cualitativas, con sus
            frecuencias.
          </span>
        </div>

        <Table headers={['Variable', 'Tipo', 'Subtipo', 'Observaciones', 'Detalle']}>
          {variables.map((variable) => (
            <TableRow key={variable.name}>
              <TableCell className="font-medium text-gray-900">{variable.name}</TableCell>
              <TableCell>
                <Badge variant={variable.type === 'quantitative' ? 'info' : 'primary'}>
                  {variable.type === 'quantitative' ? 'Cuantitativa' : 'Cualitativa'}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-600">{variable.subtype}</TableCell>
              <TableCell>{variable.count}</TableCell>
              <TableCell className="text-caption text-gray-600">
                {variable.type === 'quantitative' ? (
                  <span className="font-mono">
                    μ {variable.mean} · md {variable.median} · mín {variable.min} · máx {variable.max}
                  </span>
                ) : (
                  <span>
                    {variable.frequencies
                      ?.slice(0, 3)
                      .map((item) => `${item.value} (${item.count})`)
                      .join(' · ')}
                    {variable.frequencies && variable.frequencies.length > 3 ? ' …' : ''}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </section>

      {/* Historial de cálculos automáticos */}
      <section className="space-y-4">
        <h2 className="text-h3 text-gray-800">Historial de análisis automáticos</h2>
        <p className="text-body-sm text-gray-600">
          Cada cálculo queda registrado para poder consultarlo después (RF-21). Se desactiva desde{' '}
          <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
            Automatizaciones
          </Link>
          .
        </p>
        <Table headers={['Fecha', 'Tipo', 'Análisis', 'Resultado']}>
          {history.slice(0, 12).map((entry) => (
            <TableRow key={`${entry.id}-${entry.label}`}>
              <TableCell className="text-gray-600">
                {new Date(entry.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
              </TableCell>
              <TableCell>
                <Badge variant="neutral">{entry.kind}</Badge>
              </TableCell>
              <TableCell className="font-medium text-gray-900">{entry.label}</TableCell>
              <TableCell>{entry.result}</TableCell>
            </TableRow>
          ))}
        </Table>
        <Button
          variant="outline"
          onClick={() => {
            setHistory(listAnalyses())
          }}
        >
          Actualizar historial
        </Button>
      </section>
    </div>
  )
}
