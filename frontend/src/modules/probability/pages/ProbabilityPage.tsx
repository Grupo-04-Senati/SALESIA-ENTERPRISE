import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ListChecks, Percent, TrendingUp } from 'lucide-react'
import Button from '@/components/ui/Button'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Badge from '@/components/ui/Badge'
import BayesChart from '@/components/charts/BayesChart'
import MediaChart from '@/components/charts/MediaChart'
import MedianChart from '@/components/charts/MedianChart'
import BayesForm from '../components/BayesForm'
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID, compareMeanMedian, forecastMonthlyRevenue } from '@/data/analytics'
import {
  getBayesScenarios,
  getStatisticalDatasets,
  getSystemVariables,
} from '@/data/analytics'
import type { PeriodMonths } from '@/data/analytics'
import { useDataVersion } from '@/data/DataProvider'
import { useLang } from '@/i18n/i18n'
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

const TAB_ITEMS = [
  { id: 'media', label: 'probability.media-y-mediana' },
  { id: 'bayes', label: 'probability.bayes' },
  { id: 'predicciones', label: 'probability.predicciones' },
  { id: 'variables', label: 'probability.variables' },
  { id: 'historial', label: 'probability.historial' },
]

/** Mensaje de la regla RN-40 cuando el periodo no alcanza observaciones. */
function Rn40Message() {
  const { t } = useLang()
  return (
    <div className="card">
      <p className="text-body-sm text-gray-600">
        {t('probability.la-regla-rn-40-exige-al-menos-n-observaciones-y-el-periodo-seleccionado-no-tiene-suficientes-datos-amplia-el-periodo-o-registra-mas-ventas-en', {
          n: minObservations(),
        })}{' '}
        <Link to="/ventas" className="font-medium text-primary hover:underline">
          {t('probability.ventas')}
        </Link>
        .
      </p>
    </div>
  )
}

/** Mensaje de la regla RN-43 cuando P(B) = 0 bloquea el cálculo. */
function Rn43Message({ message }: { message: string }) {
  const { t } = useLang()
  return (
    <div className="card space-y-2">
      <p className="text-body-sm font-semibold text-gray-900">
        {t('probability.calculo-bloqueado-por-una-regla')}
      </p>
      <p className="text-body-sm text-gray-600">{message}</p>
      <p className="text-body-sm text-gray-600">
        {t('probability.registra-ventas-en')}{' '}
        <Link to="/ventas" className="font-medium text-primary hover:underline">
          {t('probability.ventas')}
        </Link>{' '}
        {t('probability.para-que-la-evidencia-sea-distinta-de-cero')}
      </p>
    </div>
  )
}

export default function ProbabilityPage() {
  const { t } = useLang()
  const [months, setMonths] = useState<PeriodMonths>(12)
  const [datasetId, setDatasetId] = useState('total')
  const [scenarioId, setScenarioId] = useState('recurrente-ticket')
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [tab, setTab] = useState('media')
  const version = useDataVersion()

  const filters = useMemo(() => ({ months, seller: '', category: '' }), [months])
  const datasets = useMemo(() => getStatisticalDatasets(filters), [filters, version])
  const scenarios = useMemo(() => getBayesScenarios(), [version])
  const variables = useMemo(() => getSystemVariables(filters), [filters, version])
  const forecast = useMemo(() => forecastMonthlyRevenue(filters), [filters, version])

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

  const bayesCalc = useMemo(() => {
    if (!scenario) return { result: null, error: null }
    // RN-43 puede bloquear el cálculo: no se lanza durante el render,
    // se muestra como estado de la pestaña (BD vacía = P(B) = 0).
    try {
      return {
        result: bayes({ prior: scenario.prior, likelihood: scenario.likelihood, evidence: scenario.evidence }),
        error: null,
      }
    } catch (reason) {
      return {
        result: null,
        error: reason instanceof Error ? reason.message : t('probability.no-se-pudo-calcular-el-posterior'),
      }
    }
  }, [scenario, version])
  const posterior = bayesCalc.result
  const bayesError = bayesCalc.error

  /* Cada cálculo automático queda registrado en el historial (RF-21). */
  useEffect(() => {
    if (!estadistico) return
    registerAnalysis({
      kind: 'media',
      label: `${t('probability.media-automatica')} · ${t(dataset.label)}`,
      result: formatCurrency(estadistico.media),
    })
    registerAnalysis({
      kind: 'mediana',
      label: `${t('probability.mediana-automatica')} · ${t(dataset.label)}`,
      result: formatCurrency(estadistico.mediana),
    })
    registerAnalysis({
      kind: 'comparacion',
      label: `${t('probability.comparacion-automatica')} · ${t(dataset.label)}`,
      result: `${t('probability.diferencia')} ${formatCurrency(Math.abs(estadistico.diferencia))} (${formatPercent(estadistico.diferenciaPct / 100)})`,
    })
    if (posterior && scenario) {
      registerAnalysis({
        kind: 'bayes',
        label: `${t('probability.bayes-automatico')} · ${t(scenario.eventA, { seller: scenario.seller ?? '—' })} → ${t(scenario.eventB)}`,
        result: `P(A|B) = ${posterior.posterior}`,
      })
    }
    if (forecast) {
      registerAnalysis({
        kind: 'prediccion',
        label: `${t('probability.pronostico-automatico')} · ${forecast.proximo.mes}`,
        result: formatCurrency(forecast.proximo.ingresos),
      })
    }
    setHistory(listAnalyses())
  }, [estadistico, posterior, forecast, dataset, scenario, version])

  const faltaDatosMedia = !estadistico
  const faltaDatosBayes = !posterior

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('probability.probabilidad')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          {t('probability.media-mediana-teorema-de-bayes-y-clasificacion-de-variables-calculados')}{' '}
          <span className="font-semibold text-primary">{t('probability.automaticamente')}</span>{' '}
          {t('probability.sobre-los-datos-del-sistema-fase-09')}
        </p>
      </div>

      {/* Filtros: eligen qué datos se analizan, sin escribirlos */}
      <BayesForm
        months={months}
        datasetId={dataset.id}
        scenarioId={scenario.id}
        datasets={datasets}
        scenarios={scenarios}
        onMonthsChange={setMonths}
        onDatasetChange={setDatasetId}
        onScenarioChange={setScenarioId}
      />

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="probabilidad" />

      <TabPanel tabId="media" active={tab === 'media'}>
        {faltaDatosMedia ? (
          <Rn40Message />
        ) : (
          estadistico && (
        <>
          {/* Media y mediana automáticas */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity aria-hidden="true" className="h-5 w-5 text-primary" />
                <h2 className="text-h4 text-gray-800">{t('probability.media-y-mediana-automaticas')}</h2>
              </div>
              <span className="text-caption text-gray-500">
                {t(dataset.description)} ·{' '}
                <Link to="/ventas" className="font-medium text-primary hover:underline">
                  {t('probability.ver-ventas')}
                </Link>
              </span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: t('probability.observaciones'), value: formatNumber(estadistico.count) },
                { label: t('probability.media'), value: formatCurrency(estadistico.media), tone: 'text-primary' },
                { label: t('probability.mediana'), value: formatCurrency(estadistico.mediana), tone: 'text-accent' },
                { label: t('probability.minimo'), value: formatCurrency(estadistico.minimo) },
                { label: t('probability.maximo'), value: formatCurrency(estadistico.maximo) },
                { label: t('probability.rango'), value: formatCurrency(estadistico.rango) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-caption text-gray-500">{item.label}</dt>
                  <dd className={`text-body font-semibold text-gray-900 ${item.tone ?? ''}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Cada medida con su gráfico y su explicación automática */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-h4 text-gray-800">{t('probability.media')}</h3>
                <span className="text-h4 font-bold text-primary">{formatCurrency(estadistico.media)}</span>
              </div>
              <MediaChart values={dataset.values} />
              <p className="text-body-sm text-gray-600">
                {t('probability.la-media-queda-en', {
                  valor: formatCurrency(estadistico.media),
                  n: estadistico.count,
                })}
              </p>
              <p className="text-caption text-gray-500">{t('probability.explica-media')}</p>
              {estadistico.diferenciaPct >= 5 && (
                <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                  {t('probability.interp-visual-media-alta')}
                </p>
              )}
              {estadistico.diferenciaPct <= -5 && (
                <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                  {t('probability.interp-visual-media-baja')}
                </p>
              )}
            </section>

            <section className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-h4 text-gray-800">{t('probability.mediana')}</h3>
                <span className="text-h4 font-bold text-accent">{formatCurrency(estadistico.mediana)}</span>
              </div>
              <MedianChart values={dataset.values} />
              <p className="text-body-sm text-gray-600">
                {t('probability.la-mediana-queda-en', { valor: formatCurrency(estadistico.mediana) })}
              </p>
              <p className="text-caption text-gray-500">{t('probability.explica-mediana')}</p>
              {estadistico.diferenciaPct >= 5 && (
                <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                  {t('probability.interp-visual-mediana-baja')}
                </p>
              )}
              {estadistico.diferenciaPct <= -5 && (
                <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                  {t('probability.interp-visual-mediana-alta')}
                </p>
              )}
            </section>
          </div>

          {/* Comparación con cifras automáticas */}
          <section className="card space-y-2">
            <h3 className="text-h4 text-gray-800">{t('probability.comparacion-media-mediana')}</h3>
            <p className="rounded-md bg-gray-50 px-3 py-2 text-body-sm text-gray-700">
              {t('probability.comparacion-cifras', {
                media: formatCurrency(estadistico.media),
                mediana: formatCurrency(estadistico.mediana),
                monto: formatCurrency(Math.abs(estadistico.diferencia)),
                pct: Math.abs(estadistico.diferenciaPct).toFixed(1),
              })}{' '}
              {t(estadistico.interpretacion)}
            </p>
          </section>
        </>
          )
        )}
      </TabPanel>

      <TabPanel tabId="bayes" active={tab === 'bayes'}>
        {bayesError ? (
          <Rn43Message message={bayesError} />
        ) : faltaDatosBayes ? (
          <Rn40Message />
        ) : (
          posterior &&
          scenario && (
        <>
          {/* Bayes automático */}
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Percent aria-hidden="true" className="h-5 w-5 text-primary" />
                <h2 className="text-h4 text-gray-800">{t('probability.teorema-de-bayes-automatico')}</h2>
              </div>
              <span className="text-caption text-gray-500">
                A: {t(scenario.eventA, { seller: scenario.seller ?? '—' })} · B: {t(scenario.eventB)} ·{' '}
                <Link to="/ventas" className="font-medium text-primary hover:underline">
                  {t('probability.ver-ventas')}
                </Link>
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-body-sm">
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">{t('probability.p-a-previa')}</span> · {scenario.detalle.conA}{' '}
                  {t('probability.de-n-ventas', { n: scenario.detalle.total })}{' '}
                  <span className="font-semibold text-primary">{formatPercent(scenario.prior)}</span>
                </p>
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">{t('probability.p-b-a-verosimilitud')}</span> · {scenario.detalle.conAyB}{' '}
                  {t('probability.casos-de-a-con-b')}{' '}
                  <span className="font-semibold text-accent">{formatPercent(scenario.likelihood)}</span>
                </p>
                <p className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">{t('probability.p-b-evidencia')}</span> · {scenario.detalle.conB}{' '}
                  {t('probability.de-n-ventas', { n: scenario.detalle.total })}{' '}
                  <span className="font-semibold text-primary">{formatPercent(scenario.evidence)}</span>
                </p>
                <p className="rounded-md border border-success bg-success-bg px-3 py-2 text-success-fg">
                  <span className="font-semibold">{t('probability.p-a-b-posterior')}</span> ·{' '}
                  <span className="text-h4 font-bold">{formatPercent(posterior.posterior)}</span>
                  <span className="mt-1 block text-caption">
                    {t('probability.probabilidad-de-que-ocurra')}«{t(scenario.eventA, { seller: scenario.seller ?? '—' })}»{t('probability.sabiendo-que')}«{t(scenario.eventB)}».
                  </span>
                </p>
                <ol className="space-y-1 text-caption text-gray-600">
                  {posterior.steps.map((step) => (
                    <li key={step}>• {step}</li>
                  ))}
                  <li>• {t(scenario.lectura, scenario.detalle)}</li>
                </ol>
              </div>

              <BayesChart
                prior={scenario.prior}
                likelihood={scenario.likelihood}
                evidence={scenario.evidence}
                posterior={posterior.posterior}
              />
            </div>
          </section>
        </>
          )
        )}
      </TabPanel>

      {/* Predicciones: regresión lineal automática sobre ingresos mensuales */}
      <TabPanel tabId="predicciones" active={tab === 'predicciones'}>
        {!forecast ? (
          <Rn40Message />
        ) : (
          <>
            <section className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp aria-hidden="true" className="h-5 w-5 text-primary" />
                  <h2 className="text-h4 text-gray-800">{t('probability.pronostico-de-ingresos-automatico')}</h2>
                </div>
                <span className="text-caption text-gray-500">
                  {t('probability.pronostico-fuente')}{' '}
                  <Link to="/ventas" className="font-medium text-primary hover:underline">
                    {t('probability.ver-ventas')}
                  </Link>
                </span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: t('probability.proximo-mes-estimado', { mes: forecast.proximo.mes }),
                    value: formatCurrency(forecast.proximo.ingresos),
                    tone: 'text-primary',
                  },
                  {
                    label: t('probability.pendiente-mensual'),
                    value: `${forecast.pendiente >= 0 ? '+' : '−'}${formatCurrency(Math.abs(forecast.pendiente))}`,
                    tone: forecast.pendiente >= 0 ? 'text-success-fg' : 'text-error-fg',
                  },
                  {
                    label: t('probability.confianza-del-ajuste'),
                    value: formatPercent(forecast.r2),
                  },
                  {
                    label: t('probability.meses-analizados'),
                    value: formatNumber(forecast.mesesAnalizados),
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                    <dt className="text-caption text-gray-500">{item.label}</dt>
                    <dd className={`text-body font-semibold text-gray-900 ${item.tone ?? ''}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.puntos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: CHART_AXIS, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${value.toFixed(0)}`}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ingresos"
                      name={t('probability.ingresos-historicos')}
                      stroke="#1E3A8A"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="proyectado"
                      name={t('probability.ingresos-proyectados')}
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: '#F59E0B' }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="rounded-md bg-info-bg px-3 py-2 text-caption text-info-fg">
                {t('probability.linea-azul-historico-linea-naranja-proyectado')} {t(forecast.interpretacion, {
                  monto: formatCurrency(Math.abs(forecast.pendiente)),
                })}{' '}
                {t('probability.metodo-regresion-lineal', { n: forecast.mesesAnalizados, h: forecast.horizonte })}
              </p>
            </section>
          </>
        )}
      </TabPanel>

      {/* Clasificación automática de variables */}
      <TabPanel tabId="variables" active={tab === 'variables'}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h3 text-gray-800">{t('probability.clasificacion-automatica-de-variables')}</h2>
          </div>
          <span className="text-caption text-gray-500">
            {t('probability.el-sistema-detecta-cuales-variables-son-cuantitativas-y-cuales-cualitativas-con-sus-frecuencias')}{' '}
            <Link to="/productos" className="font-medium text-primary hover:underline">
              {t('probability.ver-productos')}
            </Link>
          </span>
        </div>

        <DataTable headers={[t('probability.variable'), t('probability.tipo'), t('probability.subtipo'), t('probability.observaciones'), t('probability.detalle')]}>
          {variables.map((variable) => (
            <TableRow key={variable.name}>
              <TableCell className="font-medium text-gray-900">{t(variable.name)}</TableCell>
              <TableCell>
                <Badge variant={variable.type === 'quantitative' ? 'info' : 'primary'}>
                  {variable.type === 'quantitative' ? t('probability.cuantitativa') : t('probability.cualitativa')}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-600">{t(variable.subtype)}</TableCell>
              <TableCell>{variable.count}</TableCell>
              <TableCell className="text-caption text-gray-600">
                {variable.type === 'quantitative' ? (
                  <span className="font-mono">
                    μ {variable.mean} · md {variable.median} · {t('probability.min-abbr')} {variable.min} · {t('probability.max-abbr')} {variable.max}
                  </span>
                ) : (
                  <span>
                    {variable.frequencies
                      ?.slice(0, 3)
                      .map((item) =>
                        `${item.value.startsWith('probability.') ? t(item.value) : item.value} (${item.count})`,
                      )
                      .join(' · ')}
                    {variable.frequencies && variable.frequencies.length > 3 ? ' …' : ''}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </section>
      </TabPanel>

      {/* Historial de cálculos automáticos */}
      <TabPanel tabId="historial" active={tab === 'historial'}>
      <section className="space-y-4">
        <h2 className="text-h3 text-gray-800">{t('probability.historial-de-analisis-automaticos')}</h2>
        <p className="text-body-sm text-gray-600">
          {t('probability.cada-calculo-queda-registrado-para-poder-consultarlo-despues-rf-21-se-desactiva-desde')}{' '}
          <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
            {t('probability.automatizaciones')}
          </Link>
          .
        </p>
        <DataTable headers={[t('probability.fecha'), t('probability.tipo'), t('probability.analisis'), t('probability.resultado')]}>
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
        </DataTable>
        <Button
          variant="outline"
          onClick={() => {
            setHistory(listAnalyses())
          }}
        >
          {t('probability.actualizar-historial')}
        </Button>
      </section>
      </TabPanel>
    </div>
  )
}
