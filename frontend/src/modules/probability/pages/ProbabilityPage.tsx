import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Calculator, ListChecks, Percent } from 'lucide-react'
import Button from '@/components/ui/Button'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID, getTicketDataset, mean, median } from '@/modules/analytics/services/statisticsService'
import { getBusinessBayes } from '@/data/analytics'
import { useDataVersion } from '@/data/DataProvider'
import BayesForm from '../components/BayesForm'
import {
  bayes,
  classifyVariable,
  describe,
  listAnalyses,
  parseValues,
  registerAnalysis,
} from '../services/probabilityService'
import type { AnalysisRecord, VariableClassification } from '@/types/statistics'

/**
 * Módulo de Probabilidad y estadística — Semana 07 (Fase 09 · RF-11…RF-17, RF-21):
 * calculadora de media/mediana, teorema de Bayes, clasificación de
 * variables aleatorias e historial reproducible de análisis.
 * TODO(Fase 05): los cálculos se replicarán en el backend; aquí quedan
 * listos para que las vistas funcionen desde ya.
 */

const SAMPLE = '120 98 145 87 160 132 110 175 95 128'

export default function ProbabilityPage() {
  const toast = useToast()

  const [values, setValues] = useState(SAMPLE)
  const [summary, setSummary] = useState<ReturnType<typeof describe> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [variableName, setVariableName] = useState('categoría')
  const [variableValues, setVariableValues] = useState('Bebidas Abarrotes Bebidas Limpieza Bebidas Abarrotes')
  const [classification, setClassification] = useState<VariableClassification | null>(null)
  const [variableError, setVariableError] = useState<string | null>(null)

  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const version = useDataVersion()

  /* ---------------- Cálculo automático con los datos del sistema ---------------- */
  // Se recalcula solo: usa los tickets de las ventas registradas.
  const automatic = useMemo(() => {
    const tickets = getTicketDataset({ months: 12, seller: '', category: '' })
    const sorted = [...tickets].sort((a, b) => a - b)
    return {
      count: tickets.length,
      media: mean(tickets),
      mediana: median(tickets),
      minimo: sorted[0] ?? 0,
      maximo: sorted[sorted.length - 1] ?? 0,
      rango: (sorted[sorted.length - 1] ?? 0) - (sorted[0] ?? 0),
      datos: tickets,
    }
    // `version` dispara el recálculo cuando otro módulo registra una venta.
  }, [version])

  // Escenario de Bayes construido con el negocio real (segmento vs. ticket alto).
  const escenario = useMemo(() => {
    const datos = getBusinessBayes()
    const posterior = bayes({ prior: datos.prior, likelihood: datos.likelihood, evidence: datos.evidence })
    return { datos, posterior }
  }, [version])

  useEffect(() => {
    setHistory(listAnalyses())
  }, [])

  const refreshHistory = () => setHistory(listAnalyses())

  const handleCalculate = () => {
    try {
      const parsed = parseValues(values)
      const result = describe(parsed)
      setSummary(result)
      setError(null)
      registerAnalysis({ kind: 'media', label: 'Media · cálculo manual', result: `S/ ${result.mean}` })
      registerAnalysis({ kind: 'mediana', label: 'Mediana · cálculo manual', result: `S/ ${result.median}` })
      registerAnalysis({
        kind: 'comparacion',
        label: 'Media vs. mediana · cálculo manual',
        result: `Diferencia S/ ${Math.abs(result.compare.difference)} (${formatPercent(result.compare.differencePct / 100)})`,
      })
      refreshHistory()
      toast.success('Cálculo registrado', 'Media, mediana y comparación añadidas al historial.')
    } catch (reason: unknown) {
      setSummary(null)
      const message = reason instanceof Error ? reason.message : 'No se pudo calcular'
      setError(message)
      toast.error('Datos insuficientes', message)
    }
  }

  const handleClassify = () => {
    try {
      const result = classifyVariable(variableName, variableValues)
      setClassification(result)
      setVariableError(null)
      registerAnalysis({
        kind: 'variable',
        label: `Variable · ${result.name}`,
        result:
          result.type === 'quantitative'
            ? `Cuantitativa ${result.subtype} (${result.count} obs.)`
            : `Cualitativa nominal (${result.frequencies?.length ?? 0} valores)`,
      })
      refreshHistory()
    } catch (reason: unknown) {
      setClassification(null)
      setVariableError(reason instanceof Error ? reason.message : 'No se pudo clasificar')
    }
  }

  const distribution = summary
    ? [
        { rango: 'Mín', valor: summary.min },
        { rango: 'Media', valor: summary.mean },
        { rango: 'Mediana', valor: summary.median },
        { rango: 'Máx', valor: summary.max },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1>Probabilidad</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Media, mediana, teorema de Bayes y variables aleatorias — Semana 07 (Fase 09).
        </p>
      </div>

      {/* Cálculo automático */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h4 text-gray-800">Cálculo automático de los datos del sistema</h2>
          </div>
          <span className="text-caption text-gray-500">
            Se actualiza con cada venta registrada ·{' '}
            <Link to="/ventas" className="font-medium text-primary hover:underline">
              ir a Ventas
            </Link>
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Tickets', value: formatNumber(automatic.count) },
            { label: 'Media', value: formatCurrency(automatic.media), tone: 'text-primary' },
            { label: 'Mediana', value: formatCurrency(automatic.mediana), tone: 'text-accent' },
            { label: 'Mínimo', value: formatCurrency(automatic.minimo) },
            { label: 'Máximo', value: formatCurrency(automatic.maximo) },
            { label: 'Rango', value: formatCurrency(automatic.rango) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-gray-50 p-3">
              <dt className="text-caption text-gray-500">{item.label}</dt>
              <dd className={`text-body font-semibold text-gray-900 ${item.tone ?? ''}`}>{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={automatic.datos.map((ticket, index) => ({ index: index + 1, ticket }))}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="index" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
              <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `S/${Math.round(value)}`} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="ticket" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <ReferenceLine y={automatic.media} stroke="#1E3A8A" strokeDasharray="4 4" />
              <ReferenceLine y={automatic.mediana} stroke="#06B6D4" strokeDasharray="4 4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-caption text-gray-500">
          Línea azul: media · línea cyan: mediana. Valores calculados sobre las ventas del sistema.
        </p>
      </section>

      {/* Bayes automático del negocio */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Percent aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h4 text-gray-800">Bayes automático del negocio</h2>
          </div>
          <span className="text-caption text-gray-500">A = cliente recurrente · B = ticket sobre el promedio</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-body-sm">
            <p className="rounded-md bg-gray-50 px-3 py-2">
              <span className="font-semibold text-gray-900">P(A) previa</span> ·{' '}
              {escenario.datos.detalle.recurrentes} de {escenario.datos.detalle.clientes} clientes activos son
              recurrentes = <span className="font-semibold text-primary">{formatPercent(escenario.datos.prior)}</span>
            </p>
            <p className="rounded-md bg-gray-50 px-3 py-2">
              <span className="font-semibold text-gray-900">P(B|A) verosimilitud</span> ·{' '}
              {escenario.datos.detalle.comprasAltasRecurrente} de {escenario.datos.detalle.ventasRecurrente} compras
              de recurrentes superan el ticket promedio ({formatCurrency(escenario.datos.detalle.ticketPromedio)}) ={' '}
              <span className="font-semibold text-accent">{formatPercent(escenario.datos.likelihood)}</span>
            </p>
            <p className="rounded-md bg-gray-50 px-3 py-2">
              <span className="font-semibold text-gray-900">P(B) evidencia</span> ·{' '}
              {escenario.datos.detalle.comprasAltas} de {escenario.datos.detalle.ventasValidas} ventas superan el
              promedio = <span className="font-semibold text-primary">{formatPercent(escenario.datos.evidence)}</span>
            </p>
            <p className="rounded-md border border-success bg-success-bg px-3 py-2 text-success-fg">
              <span className="font-semibold">P(A|B) posterior</span> ·{' '}
              <span className="text-h4 font-bold">{formatPercent(escenario.posterior.posterior)}</span> — la
              probabilidad de que un comprador con ticket alto sea cliente recurrente.
            </p>
            <ol className="space-y-1 text-caption text-gray-600">
              {escenario.posterior.steps.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ol>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'P(A) previa', valor: escenario.datos.prior },
                  { name: 'P(B|A)', valor: escenario.datos.likelihood },
                  { name: 'P(A|B) posterior', valor: escenario.posterior.posterior },
                ]}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
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

      {/* Calculadora estadística */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Calculator aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Calculadora de media y mediana</h2>
        </div>

        <Textarea
          label="Observaciones"
          hint="Separa los valores con espacios o comas (mínimo 2, RN-40)"
          value={values}
          onChange={(event) => setValues(event.target.value)}
        />

        <Button onClick={handleCalculate}>Calcular</Button>

        {error && (
          <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
            {error}
          </p>
        )}

        {summary && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4">
              <dl className="grid grid-cols-2 gap-y-2 text-body-sm">
                <div>
                  <dt className="text-caption text-gray-500">Observaciones</dt>
                  <dd className="font-semibold text-gray-900">{formatNumber(summary.count)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Media</dt>
                  <dd className="font-semibold text-primary">{formatCurrency(summary.mean)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Mediana</dt>
                  <dd className="font-semibold text-accent">{formatCurrency(summary.median)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Rango</dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(summary.range)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Mínimo</dt>
                  <dd className="font-medium text-gray-700">{formatCurrency(summary.min)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Máximo</dt>
                  <dd className="font-medium text-gray-700">{formatCurrency(summary.max)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                {summary.compare.interpretation}
              </p>
            </div>

            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="rango" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                  <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <ReferenceLine y={summary.mean} stroke="#1E3A8A" strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Bayes */}
      <section className="card space-y-4">
        <h2 className="text-h4 text-gray-800">Teorema de Bayes</h2>
        <p className="text-caption text-gray-500">
          P(A|B) = P(B|A) · P(A) / P(B) — resultado reproducible y explicable (RF-17).
        </p>
        <BayesForm
          onResult={(posterior) => {
            registerAnalysis({ kind: 'bayes', label: 'Bayes · cálculo manual', result: `P(A|B) = ${posterior}` })
            refreshHistory()
          }}
        />
      </section>

      {/* Clasificación de variables */}
      <section className="card space-y-4">
        <h2 className="text-h4 text-gray-800">Clasificación de variables</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Nombre de la variable"
            value={variableName}
            onChange={(event) => setVariableName(event.target.value)}
            className="sm:col-span-1"
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Observaciones"
              value={variableValues}
              onChange={(event) => setVariableValues(event.target.value)}
            />
          </div>
        </div>
        <Button variant="secondary" onClick={handleClassify}>
          Clasificar variable
        </Button>

        {variableError && (
          <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
            {variableError}
          </p>
        )}

        {classification && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body-sm font-semibold text-gray-900">{classification.name}</span>
              <Badge variant={classification.type === 'quantitative' ? 'info' : 'primary'}>
                {classification.type === 'quantitative' ? 'Cuantitativa' : 'Cualitativa'}
              </Badge>
              <Badge variant="neutral">{classification.subtype}</Badge>
              <span className="text-caption text-gray-500">{classification.count} observaciones</span>
            </div>

            {classification.type === 'quantitative' ? (
              <dl className="grid grid-cols-2 gap-y-2 rounded-lg bg-gray-50 p-4 text-body-sm sm:grid-cols-4">
                <div>
                  <dt className="text-caption text-gray-500">Media</dt>
                  <dd className="font-semibold">{formatCurrency(classification.mean ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Mediana</dt>
                  <dd className="font-semibold">{formatCurrency(classification.median ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Mínimo</dt>
                  <dd className="font-medium">{formatCurrency(classification.min ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-gray-500">Máximo</dt>
                  <dd className="font-medium">{formatCurrency(classification.max ?? 0)}</dd>
                </div>
              </dl>
            ) : (
              <Table headers={['Valor', 'Frecuencia', '%']}>
                {classification.frequencies?.map((frequency) => (
                  <TableRow key={frequency.value}>
                    <TableCell className="font-medium">{frequency.value}</TableCell>
                    <TableCell>{frequency.count}</TableCell>
                    <TableCell>{formatPercent(frequency.pct / 100)}</TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}
      </section>

      {/* Historial de análisis */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Historial de análisis</h2>
        </div>
        <p className="text-body-sm text-gray-600">
          Cada cálculo queda registrado con su resultado para poder consultarlo después (RF-21).
        </p>
        <Table headers={['Fecha', 'Tipo', 'Análisis', 'Resultado']}>
          {history.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-gray-600">
                {new Date(entry.created_at).toLocaleDateString('es-PE')}
              </TableCell>
              <TableCell>
                <Badge variant="neutral">{entry.kind}</Badge>
              </TableCell>
              <TableCell className="font-medium text-gray-900">{entry.label}</TableCell>
              <TableCell>{entry.result}</TableCell>
            </TableRow>
          ))}
        </Table>
      </section>
    </div>
  )
}
