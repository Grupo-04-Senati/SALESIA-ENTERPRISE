import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, ListTree, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import { Input, Select } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatDateTime } from '@/utils/formatters'
import { useLang } from '@/i18n/i18n'
import type { InsightSeverity } from '@/types/insight'
import { useInsights } from '@/hooks/useInsights'
import { filterInsights, getActiveRules } from '../services/insightService'

/**
 * Insights empresariales (Fase 11 · RF-18…RF-20): reglas determinísticas,
 * observaciones explicables con evidencia numérica (RN-47) y relación
 * con el dataset/análisis que las originó.
 * Dos secciones en pestañas: Observaciones y Reglas.
 * TODO(Fase 05): los insights los generará el backend con los mismos
 * códigos de regla (GET /api/v1/insights).
 */

const TAB_ITEMS = [
  { id: 'observaciones', label: 'insights.observaciones' },
  { id: 'reglas', label: 'insights.reglas-deterministicas' },
]

const SEVERITY_BADGE: Record<InsightSeverity, 'info' | 'success' | 'warning' | 'error'> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'error',
}

const SEVERITY_KEYS: Record<InsightSeverity, string> = {
  INFO: 'insights.severidad-informativo',
  SUCCESS: 'insights.severidad-positivo',
  WARNING: 'insights.severidad-alerta',
  CRITICAL: 'insights.severidad-critico',
}

const EVIDENCE_LABELS: Record<string, string> = {
  ingresos: 'insights.ingresos',
  ingresos_actual: 'insights.ingresos-del-mes',
  ingresos_anterior: 'insights.ingresos-del-mes-anterior',
  mes_actual: 'insights.mes-actual',
  mes_anterior: 'insights.mes-anterior',
  variacion_pct: 'insights.variacion-pct',
  variacion_mensual_pct: 'insights.variacion-mensual-pct',
  ticket_promedio: 'insights.ticket-promedio-s',
  transacciones: 'insights.transacciones',
  vendedor: 'insights.vendedor',
  categoría: 'insights.categoria',
  participación_pct: 'insights.participacion-pct',
  umbral_pct: 'insights.umbral-pct',
  media: 'insights.media',
  mediana: 'insights.mediana',
  diferencia: 'insights.diferencia-s',
  diferencia_pct: 'insights.diferencia-pct',
  ventas_pendientes: 'insights.ventas-pendientes',
  saldo_por_cobrar: 'insights.saldo-por-cobrar-s',
  productos_en_alerta: 'insights.productos-en-alerta',
  productos_sin_stock: 'insights.productos-sin-stock',
  producto: 'insights.producto',
  unidades: 'insights.unidades',
  skus: 'insights.skus-en-alerta',
}

export default function InsightsPage() {
  const { t } = useLang()
  const [severity, setSeverity] = useState<InsightSeverity | ''>('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('observaciones')
  const { insights, loading, error, reload } = useInsights({ months: 12, seller: '', category: '' })

  const filtered = useMemo(() => filterInsights(insights, { severity, search }), [insights, severity, search])

  const counts = useMemo(
    () => ({
      total: insights.length,
      criticos: insights.filter((insight) => insight.severity === 'CRITICAL').length,
      alertas: insights.filter((insight) => insight.severity === 'WARNING').length,
      positivos: insights.filter((insight) => insight.severity === 'SUCCESS').length,
    }),
    [insights],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{t('insights.insights')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            {t('insights.observaciones-explicables-generadas-por-reglas-deterministicas-con-su-evidencia-numerica-fase-11')}
          </p>
        </div>
        <Button variant="outline" onClick={reload} loading={loading}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t('insights.regenerar')}
        </Button>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="insights" />

      {/* Observaciones */}
      <TabPanel tabId="observaciones" active={tab === 'observaciones'}>
        <div className="space-y-6">
          {/* Resumen */}
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: t('insights.insights-generados'), value: counts.total, tone: 'text-primary' },
              { label: t('insights.alertas'), value: counts.alertas, tone: 'text-warning' },
              { label: t('insights.criticos'), value: counts.criticos, tone: 'text-error' },
              { label: t('insights.positivos'), value: counts.positivos, tone: 'text-success' },
            ].map((item) => (
              <div key={item.label} className="card py-4">
                <p className="text-caption text-gray-500">{item.label}</p>
                <p className={`text-h3 font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="card flex flex-col gap-3 md:flex-row md:items-end">
            <Input
              type="search"
              aria-label={t('insights.buscar-insights')}
              placeholder={t('insights.buscar-por-titulo-mensaje-o-regla')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="md:flex-1"
            />
            <Select
              aria-label={t('insights.filtrar-por-severidad')}
              value={severity}
              onChange={(event) => setSeverity(event.target.value as InsightSeverity | '')}
              className="md:w-52"
            >
              <option value="">{t('insights.todas-las-severidades')}</option>
              {(Object.keys(SEVERITY_KEYS) as InsightSeverity[]).map((value) => (
                <option key={value} value={value}>
                  {t(SEVERITY_KEYS[value])}
                </option>
              ))}
            </Select>
          </div>

          {/* Listado */}
          {error ? (
            <div className="card">
              <ErrorState
                description={error}
                action={
                  <Button variant="outline" onClick={reload}>
                    {t('insights.reintentar')}
                  </Button>
                }
              />
            </div>
          ) : loading && insights.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-12">
              <Spinner className="text-loading" />
              <p className="text-body-sm text-gray-500">{t('insights.aplicando-reglas-deterministicas')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                title={t('insights.sin-insights')}
                description={t('insights.no-hay-observaciones-que-coincidan-con-el-filtro')}
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((insight) => (
                <article key={insight.id} className="card flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <h2 className="text-body font-semibold text-gray-900">{insight.title}</h2>
                    </div>
                    <Badge variant={SEVERITY_BADGE[insight.severity]}>{t(SEVERITY_KEYS[insight.severity])}</Badge>
                  </div>

                  <p className="text-body-sm text-gray-600">{insight.message}</p>

                  {Object.keys(insight.evidence).length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-gray-50 p-3 text-caption">
                      {Object.entries(insight.evidence).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="truncate text-gray-500">{t(EVIDENCE_LABELS[key] ?? key)}</dt>
                          <dd className="shrink-0 font-semibold text-gray-900">
                            {typeof value === 'number' ? value : value || '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-gray-400">
                    <span className="font-mono">{insight.rule}</span>
                    <span>{formatDateTime(insight.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* Reglas determinísticas */}
      <TabPanel tabId="reglas" active={tab === 'reglas'}>
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ListTree aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h3 text-gray-800">{t('insights.reglas-deterministicas-vigentes')}</h2>
          </div>
          <p className="text-body-sm text-gray-600">
            {t('insights.cada-insight-proviene-de-una-regla-fija-con-los-mismos-datos-se-obtiene-siempre-el-mismo-resultado-rf-18-las-reglas-de-alerta-se-activan-y-ajustan-desde')}{' '}
            <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
              {t('insights.automatizaciones')}
            </Link>
            .
          </p>
          <DataTable headers={[t('insights.codigo'), t('insights.descripcion'), t('insights.severidad-base'), t('insights.configurable')]}>
            {getActiveRules().map((rule) => (
              <TableRow key={rule.code}>
                <TableCell className="font-mono text-caption">{rule.code}</TableCell>
                <TableCell>{t(rule.description)}</TableCell>
                <TableCell>
                  <Badge variant={SEVERITY_BADGE[rule.severity]}>{t(SEVERITY_KEYS[rule.severity])}</Badge>
                </TableCell>
                <TableCell>
                  {rule.automationCode ? (
                    <Badge variant={rule.enabled ? 'success' : 'neutral'}>
                      {rule.enabled ? t('insights.activa') : t('insights.desactivada')}
                    </Badge>
                  ) : (
                    <span className="text-caption text-gray-400">{t('insights.siempre-activa')}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </section>
      </TabPanel>
    </div>
  )
}
