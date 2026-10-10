import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, FileText, Printer, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID } from '@/modules/analytics/services/statisticsService'
import { useDataVersion } from '@/data/DataProvider'
import {
  REPORT_TYPES,
  downloadAllCsv,
  downloadCsv,
  generateReport,
  getMonthlySummary,
  getTicketDistribution,
} from '../services/reportService'
import type { Report, ReportType } from '../services/reportService'

/**
 * Reportes (Fase 12 · RF-20): ventas, estadístico, productos, clientes y
 * vendedores, con exportación CSV y vista imprimible.
 * El reporte se genera automáticamente al entrar, al cambiar de tipo y
 * cada vez que cambia cualquier dato del sistema.
 * TODO(Fase 05): el backend generará los archivos finales
 * (POST /api/v1/reports y /reports/{id}/export).
 */

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: `1px solid ${CHART_GRID}`,
  borderRadius: 8,
  fontSize: 12,
}

const PIE_COLORS = ['#1E3A8A', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6']

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card no-print">
      <h3 className="text-h4 text-gray-800">{title}</h3>
      <div className="mt-4 h-56">{children}</div>
    </div>
  )
}

/** Conteo de clientes por segmento para el gráfico de torta. */
function segmentsOf(report: Report): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>()
  for (const row of report.rows) {
    const segment = String(row.segmento ?? '—')
    counts.set(segment, (counts.get(segment) ?? 0) + 1)
  }
  return [...counts].map(([name, value]) => ({ name, value }))
}

export default function ReportsPage() {
  const toast = useToast()
  const { t } = useLang()
  const [type, setType] = useState<ReportType>('ventas')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const version = useDataVersion()

  const selected = REPORT_TYPES.find((entry) => entry.value === type)

  // Generación automática: al entrar, al cambiar de tipo y ante cualquier
  // cambio de datos (por ejemplo, una venta nueva en Ventas).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    generateReport(type, t)
      .then((result) => {
        if (cancelled) return
        setReport(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setReport(null)
        setError(
          reason instanceof Error ? reason.message : t('reports.no-se-pudo-generar-el-reporte'),
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, version, t])

  const handleGenerate = () => {
    setLoading(true)
    generateReport(type, t)
      .then(setReport)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : t('reports.no-se-pudo-generar-el-reporte'),
        ),
      )
      .finally(() => setLoading(false))
  }

  const handleExport = () => {
    if (!report) return
    downloadCsv(report)
    toast.success(
      t('reports.reporte-exportado'),
      `${report.title} ${t('reports.descargado-en-formato-csv')}`,
    )
  }

  const handleExportAll = () => {
    setDownloadingAll(true)
    downloadAllCsv(t)
      .then(() =>
        toast.success(t('reports.todos-los-reportes-exportados'), t('reports.descarga-todos-detalle')),
      )
      .catch(() => toast.error(t('reports.no-se-pudo-generar-el-reporte')))
      .finally(() => setDownloadingAll(false))
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1>{t('reports.reportes')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          {t('reports.reportes-de-ventas-estadistico-productos-clientes-y-vendedores-con-exportacion-fase-12')}
        </p>
      </div>

      {/* Selector */}
      <div className="card no-print space-y-4">
        <div className="grid gap-3 sm:grid-cols-5">
          {REPORT_TYPES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setType(entry.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                type === entry.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-white hover:border-primary-light'
              }`}
            >
              <FileText aria-hidden="true" className={`mb-2 h-5 w-5 ${type === entry.value ? 'text-primary' : 'text-gray-400'}`} />
              <p className="text-body-sm font-semibold text-gray-900">{t(entry.label)}</p>
              <p className="mt-0.5 text-caption text-gray-500">{t(entry.description)}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleGenerate} loading={loading}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {t('reports.actualizar-ahora')}
          </Button>
          <Button variant="secondary" onClick={handleExportAll} loading={downloadingAll}>
            <Download aria-hidden="true" className="h-4 w-4" />
            {t('reports.descargar-todo-csv')}
          </Button>
          {report && (
            <>
              <Button variant="secondary" onClick={handleExport}>
                <Download aria-hidden="true" className="h-4 w-4" />
                {t('reports.exportar-csv')}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" className="h-4 w-4" />
                {t('reports.imprimir')}
              </Button>
            </>
          )}
          <span className="text-caption text-gray-500">
            {t('reports.el-reporte-se-arma-solo-con-los-datos-actuales-del-sistema')}
          </span>
        </div>
      </div>

      {/* Resultado */}
      {error ? (
        <div className="card no-print">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={handleGenerate}>
                {t('reports.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <div className="card no-print flex flex-col items-center gap-3 py-12">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">{t('reports.generando-reporte')}</p>
        </div>
      ) : !report ? (
        <div className="card no-print">
          <EmptyState
            title={t('reports.sin-reporte-generado')}
            description={
              t(
                selected?.description ??
                  'reports.elige-un-tipo-de-reporte-y-genralo-para-verlo-aqui',
              )
            }
            action={
              <Button onClick={handleGenerate}>
                <FileText aria-hidden="true" className="h-4 w-4" />
                {t('reports.generar-reporte')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6 print-area">
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-h3 text-gray-900">{report.title}</h2>
                <p className="mt-1 text-body-sm text-gray-600">{report.description}</p>
              </div>
              <Badge variant="neutral">
                {t('reports.generado')} {formatDateTime(report.generated_at)}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {report.summary.map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-caption text-gray-500">{item.label}</dt>
                  <dd className="mt-0.5 text-body font-semibold text-gray-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {report.type === 'ventas' &&
            (getMonthlySummary().every((point) => point.ingresos === 0) ? (
              <div className="card no-print">
                <h3 className="text-h4 text-gray-800">{t('reports.evolucion-mensual-referencia')}</h3>
                <EmptyState
                  title={t('reports.sin-ventas-en-el-periodo')}
                  description={t('reports.la-evolucion-mensual-se-dibujara-cuando-haya-ventas-registradas')}
                />
              </div>
            ) : (
              <div className="card no-print">
                <h3 className="text-h4 text-gray-800">{t('reports.evolucion-mensual-referencia')}</h3>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getMonthlySummary()} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                      <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="ingresos" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}

          {report.type === 'estadistico' &&
            (getTicketDistribution().every((bin) => bin.frecuencia === 0) ? (
              <div className="card no-print">
                <h3 className="text-h4 text-gray-800">
                  {t('analytics.frecuencias-por-rango-de-ticket-promedio-txt-62-histogram')}
                </h3>
                <EmptyState
                  title={t('reports.sin-ventas-en-el-periodo')}
                  description={t('reports.este-reporte-no-tiene-registros-porque-todavia-no-hay-datos-en-el-sistema')}
                />
              </div>
            ) : (
              <ChartCard title={t('analytics.frecuencias-por-rango-de-ticket-promedio-txt-62-histogram')}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getTicketDistribution()} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="rango"
                      tick={{ fill: CHART_AXIS, fontSize: 12 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Ventas con ese rango de ticket']} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="frecuencia" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            ))}

          {report.type === 'productos' && report.rows.length > 0 && (
            <ChartCard title="Stock por producto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.rows.map((row) => ({
                    producto: String(row.producto),
                    stock: Number(row.stock),
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="producto"
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    axisLine={{ stroke: CHART_GRID }}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${formatNumber(Number(value))} uds`, t('reports.col-stock')]} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="stock" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {report.type === 'clientes' && report.rows.length > 0 && (
            <ChartCard title="Clientes por segmento">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segmentsOf(report)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={84}
                    paddingAngle={2}
                  >
                    {segmentsOf(report).map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${formatNumber(Number(value))} ${t('reports.clientes')}`} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {report.type === 'vendedores' && report.rows.length > 0 && (
            <ChartCard title="Ingresos por vendedor">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.rows.map((row) => ({
                    vendedor: String(row.vendedor),
                    ingresos: Number(row.ingresos),
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="vendedor" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                  <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {report.rows.length === 0 ? (
            <div className="card no-print">
              <EmptyState
                title={t('reports.sin-registros')}
                description={t('reports.este-reporte-no-tiene-registros-porque-todavia-no-hay-datos-en-el-sistema')}
                action={
                  <Button onClick={handleGenerate}>
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    {t('reports.actualizar-reporte')}
                  </Button>
                }
              />
            </div>
          ) : (
            <DataTable headers={report.columns.map((column) => column.label)}>
              {report.rows.map((row, index) => (
                <TableRow key={index}>
                  {report.columns.map((column) => {
                    const value = row[column.key]
                    // Unidad explícita (reporte estadístico): 'uds' y '%' no
                    // son dinero, aunque la clave de la columna sea "valor".
                    const unidad = typeof row.unidad === 'string' ? row.unidad : ''
                    let display: string | number
                    if (typeof value !== 'number') {
                      display = value
                    } else if (unidad === 'uds' || unidad === '%') {
                      display = formatNumber(value)
                    } else if (unidad === 'S/') {
                      display = formatCurrency(value)
                    } else if (
                      column.key.includes('total') ||
                      column.key.includes('ingreso') ||
                      column.key.includes('costo') ||
                      column.key.includes('precio') ||
                      column.key.includes('ticket') ||
                      column.key.includes('impuesto') ||
                      column.key.includes('descuento') ||
                      column.key.includes('saldo') ||
                      column.key.includes('media') ||
                      column.key.includes('mediana') ||
                      column.key.includes('diferencia') ||
                      column.key.includes('minimo') ||
                      column.key.includes('maximo') ||
                      column.key === 'valor'
                    ) {
                      display = formatCurrency(value)
                    } else {
                      display = formatNumber(value)
                    }
                    return (
                      <TableCell key={column.key} className={column.align === 'right' ? 'text-right' : undefined}>
                        {display}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </DataTable>
          )}

          <p className="text-caption text-gray-400">
            {t('reports.registros', { n: report.rows.length })} · SalesIA Enterprise · {formatDateTime(report.generated_at)}
          </p>
        </div>
      )}
    </div>
  )
}
