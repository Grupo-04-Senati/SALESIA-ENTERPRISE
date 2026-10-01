import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, ListTree, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Input, Select } from '@/components/ui/form'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { formatDateTime } from '@/utils/formatters'
import { SEVERITY_LABELS } from '@/types/insight'
import type { InsightSeverity } from '@/types/insight'
import { useInsights } from '@/hooks/useInsights'
import { filterInsights, getActiveRules } from '../services/insightService'

/**
 * Insights empresariales (Fase 11 · RF-18…RF-20): reglas determinísticas,
 * observaciones explicables con evidencia numérica (RN-47) y relación
 * con el dataset/análisis que las originó.
 * TODO(Fase 05): los insights los generará el backend con los mismos
 * códigos de regla (GET /api/v1/insights).
 */

const SEVERITY_BADGE: Record<InsightSeverity, 'info' | 'success' | 'warning' | 'error'> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'error',
}

const EVIDENCE_LABELS: Record<string, string> = {
  ingresos: 'Ingresos (S/)',
  ingresos_actual: 'Ingresos del mes (S/)',
  ingresos_anterior: 'Ingresos del mes anterior (S/)',
  mes_actual: 'Mes actual',
  mes_anterior: 'Mes anterior',
  variacion_pct: 'Variación (%)',
  variacion_mensual_pct: 'Variación mensual (%)',
  ticket_promedio: 'Ticket promedio (S/)',
  transacciones: 'Transacciones',
  vendedor: 'Vendedor',
  categoría: 'Categoría',
  participación_pct: 'Participación (%)',
  umbral_pct: 'Umbral (%)',
  media: 'Media',
  mediana: 'Mediana',
  diferencia: 'Diferencia (S/)',
  diferencia_pct: 'Diferencia (%)',
  ventas_pendientes: 'Ventas pendientes',
  saldo_por_cobrar: 'Saldo por cobrar (S/)',
  productos_en_alerta: 'Productos en alerta',
  productos_sin_stock: 'Productos sin stock',
  producto: 'Producto',
  unidades: 'Unidades',
  skus: 'SKUs en alerta',
}

export default function InsightsPage() {
  const [severity, setSeverity] = useState<InsightSeverity | ''>('')
  const [search, setSearch] = useState('')
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
          <h1>Insights</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Observaciones explicables generadas por reglas determinísticas, con su evidencia numérica
            (Fase 11).
          </p>
        </div>
        <Button variant="outline" onClick={reload} loading={loading}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Regenerar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Insights generados', value: counts.total, tone: 'text-primary' },
          { label: 'Alertas', value: counts.alertas, tone: 'text-warning' },
          { label: 'Críticos', value: counts.criticos, tone: 'text-error' },
          { label: 'Positivos', value: counts.positivos, tone: 'text-success' },
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
          aria-label="Buscar insights"
          placeholder="Buscar por título, mensaje o regla…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:flex-1"
        />
        <Select
          aria-label="Filtrar por severidad"
          value={severity}
          onChange={(event) => setSeverity(event.target.value as InsightSeverity | '')}
          className="md:w-52"
        >
          <option value="">Todas las severidades</option>
          {(Object.keys(SEVERITY_LABELS) as InsightSeverity[]).map((value) => (
            <option key={value} value={value}>
              {SEVERITY_LABELS[value]}
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
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && insights.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">Aplicando reglas determinísticas…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState title="Sin insights" description="No hay observaciones que coincidan con el filtro." />
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
                <Badge variant={SEVERITY_BADGE[insight.severity]}>{SEVERITY_LABELS[insight.severity]}</Badge>
              </div>

              <p className="text-body-sm text-gray-600">{insight.message}</p>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-gray-50 p-3 text-caption">
                {Object.entries(insight.evidence).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="truncate text-gray-500">{EVIDENCE_LABELS[key] ?? key}</dt>
                    <dd className="shrink-0 font-semibold text-gray-900">
                      {typeof value === 'number' ? value : value || '—'}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-gray-400">
                <span className="font-mono">{insight.rule}</span>
                {insight.analysis_id && <span>análisis #{insight.analysis_id}</span>}
                {insight.dataset_id && <span>dataset #{insight.dataset_id}</span>}
                <span>{formatDateTime(insight.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Reglas determinísticas */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ListTree aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Reglas determinísticas vigentes</h2>
        </div>
        <p className="text-body-sm text-gray-600">
          Cada insight proviene de una regla fija: con los mismos datos se obtiene siempre el mismo
          resultado (RF-18). Las reglas de alerta se activan y ajustan desde{' '}
          <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
            Automatizaciones
          </Link>
          .
        </p>
        <Table headers={['Código', 'Descripción', 'Severidad base', 'Configurable']}>
          {getActiveRules().map((rule) => (
            <TableRow key={rule.code}>
              <TableCell className="font-mono text-caption">{rule.code}</TableCell>
              <TableCell>{rule.description}</TableCell>
              <TableCell>
                <Badge variant={SEVERITY_BADGE[rule.severity]}>{SEVERITY_LABELS[rule.severity]}</Badge>
              </TableCell>
              <TableCell>
                {rule.automationCode ? (
                  <Badge variant={rule.enabled ? 'success' : 'neutral'}>
                    {rule.enabled ? 'Activa' : 'Desactivada'}
                  </Badge>
                ) : (
                  <span className="text-caption text-gray-400">siempre activa</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </section>
    </div>
  )
}
