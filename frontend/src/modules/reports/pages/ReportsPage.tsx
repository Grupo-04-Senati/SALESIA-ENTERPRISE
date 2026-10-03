import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileText, Printer, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID } from '@/modules/analytics/services/statisticsService'
import { useDataVersion } from '@/data/DataProvider'
import {
  REPORT_TYPES,
  downloadCsv,
  generateReport,
  getMonthlySummary,
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

export default function ReportsPage() {
  const toast = useToast()
  const [type, setType] = useState<ReportType>('ventas')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const version = useDataVersion()

  const selected = REPORT_TYPES.find((entry) => entry.value === type)

  // Generación automática: al entrar, al cambiar de tipo y ante cualquier
  // cambio de datos (por ejemplo, una venta nueva en Ventas).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    generateReport(type)
      .then((result) => {
        if (cancelled) return
        setReport(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setReport(null)
        setError(reason instanceof Error ? reason.message : 'No se pudo generar el reporte')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, version])

  const handleGenerate = () => {
    setLoading(true)
    generateReport(type)
      .then(setReport)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'No se pudo generar el reporte'),
      )
      .finally(() => setLoading(false))
  }

  const handleExport = () => {
    if (!report) return
    downloadCsv(report)
    toast.success('Reporte exportado', `${report.title} descargado en formato CSV.`)
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1>Reportes</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Reportes de ventas, estadístico, productos, clientes y vendedores con exportación (Fase 12).
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
              <p className="text-body-sm font-semibold text-gray-900">{entry.label}</p>
              <p className="mt-0.5 text-caption text-gray-500">{entry.description}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleGenerate} loading={loading}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar ahora
          </Button>
          {report && (
            <>
              <Button variant="secondary" onClick={handleExport}>
                <Download aria-hidden="true" className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" className="h-4 w-4" />
                Imprimir
              </Button>
            </>
          )}
          <span className="text-caption text-gray-500">
            El reporte se arma solo con los datos actuales del sistema.
          </span>
        </div>
      </div>

      {/* Resultado */}
      {error ? (
        <div className="card no-print">
          <ErrorState description={error} action={<Button variant="outline" onClick={handleGenerate}>Reintentar</Button>} />
        </div>
      ) : loading ? (
        <div className="card no-print flex flex-col items-center gap-3 py-12">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">Generando reporte…</p>
        </div>
      ) : !report ? (
        <div className="card no-print">
          <EmptyState
            title="Sin reporte generado"
            description={selected?.description ?? 'Elige un tipo de reporte y genéralo para verlo aquí.'}
            action={
              <Button onClick={handleGenerate}>
                <FileText aria-hidden="true" className="h-4 w-4" />
                Generar reporte
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
              <Badge variant="neutral">Generado {formatDateTime(report.generated_at)}</Badge>
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
                <h3 className="text-h4 text-gray-800">Evolución mensual (referencia)</h3>
                <EmptyState
                  title="Sin ventas en el periodo"
                  description="La evolución mensual se dibujará cuando haya ventas registradas."
                />
              </div>
            ) : (
              <div className="card no-print">
                <h3 className="text-h4 text-gray-800">Evolución mensual (referencia)</h3>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getMonthlySummary()} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                      <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: '#FFFFFF', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="ingresos" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}

          {report.rows.length === 0 ? (
            <div className="card no-print">
              <EmptyState
                title="Sin registros"
                description="Este reporte no tiene registros porque todavía no hay datos en el sistema."
                action={
                  <Button onClick={handleGenerate}>
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Actualizar reporte
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
                    return (
                      <TableCell key={column.key} className={column.align === 'right' ? 'text-right' : undefined}>
                        {typeof value === 'number'
                          ? column.key.includes('total') || column.key.includes('ingreso') || column.key.includes('costo') || column.key.includes('precio') || column.key.includes('ticket') || column.key.includes('impuesto') || column.key.includes('descuento') || column.key.includes('saldo')
                            ? formatCurrency(value)
                            : column.key.includes('media') || column.key.includes('mediana') || column.key.includes('diferencia') || column.key.includes('minimo') || column.key.includes('maximo') || column.key === 'valor'
                              ? formatCurrency(value)
                              : formatNumber(value)
                          : value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </DataTable>
          )}

          <p className="text-caption text-gray-400">
            {report.rows.length} registros · SalesIA Enterprise · {formatDateTime(report.generated_at)}
          </p>
        </div>
      )}
    </div>
  )
}
