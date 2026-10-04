import { useEffect, useState } from 'react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatDateTime } from '@/utils/formatters'
import {
  createScheduledReport,
  deleteScheduledReport,
  listScheduledReports,
  updateScheduledReport,
} from '../services/systemService'
import type {
  ReportFrequency,
  ReportType,
  ScheduledReport,
  ScheduledReportInput,
} from '../services/systemService'

/** Pestaña «Reportes» de Configuración (ENDPOINTS.scheduledReports). */

const REPORT_TYPES: ReportType[] = ['ventas', 'estadistico', 'productos', 'clientes', 'vendedores']
const FREQUENCIES: ReportFrequency[] = ['daily', 'weekly', 'monthly']

const REPORT_TYPE_KEYS: Record<ReportType, string> = {
  ventas: 'settings.tipo-reporte-ventas',
  estadistico: 'settings.tipo-reporte-estadistico',
  productos: 'settings.tipo-reporte-productos',
  clientes: 'settings.tipo-reporte-clientes',
  vendedores: 'settings.tipo-reporte-vendedores',
}

const FREQUENCY_KEYS: Record<ReportFrequency, string> = {
  daily: 'settings.frecuencia-diaria',
  weekly: 'settings.frecuencia-semanal',
  monthly: 'settings.frecuencia-mensual',
}

const EMPTY_FORM = {
  report_type: 'ventas' as ReportType,
  title: '',
  frequency: 'weekly' as ReportFrequency,
  next_run_at: '',
  status: 'active',
}

const pad = (value: number) => String(value).padStart(2, '0')

function toInputDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ReportsPanel() {
  const toast = useToast()
  const { t } = useLang()

  const [items, setItems] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledReport | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ScheduledReport | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listScheduledReports()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('settings.no-se-pudieron-cargar-los-reportes'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (report: ScheduledReport) => {
    setEditing(report)
    setForm({
      report_type: report.report_type,
      title: report.title,
      frequency: report.frequency,
      next_run_at: toInputDateTime(report.next_run_at),
      status: report.status,
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (title.length < 3) {
      setFormError(t('settings.el-titulo-debe-tener-al-menos-3-caracteres'))
      return
    }
    const input: ScheduledReportInput = {
      report_type: form.report_type,
      title,
      frequency: form.frequency,
      next_run_at: form.next_run_at || null,
      status: form.status === 'active' ? 'active' : 'inactive',
    }
    setSaving(true)
    try {
      if (editing) {
        await updateScheduledReport(editing.id, input)
        toast.success(
          t('settings.reporte-actualizado'),
          `${title} ${t('settings.se-guardo-correctamente')}`,
        )
      } else {
        await createScheduledReport(input)
        toast.success(
          t('settings.reporte-programado'),
          `${title} ${t('settings.quedo-en-el-calendario')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('settings.no-se-pudo-guardar-el-reporte'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteScheduledReport(deleting.id)
      toast.success(
        t('settings.reporte-eliminado'),
        `${deleting.title} ${t('settings.se-quito-del-calendario')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : t('settings.no-se-pudo-eliminar-el-reporte'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('settings.reportes-que-se-generan-solos')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('settings.nuevo-reporte')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('settings.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('settings.reporte'),
              t('settings.titulo'),
              t('settings.frecuencia'),
              t('settings.proxima-ejecucion'),
              t('settings.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('settings.cargando-reportes')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title={t('settings.sin-reportes-programados')}
            description={t('settings.programa-tu-primer-reporte')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('settings.nuevo-reporte')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('settings.reporte'),
              t('settings.titulo'),
              t('settings.frecuencia'),
              t('settings.proxima-ejecucion'),
              t('settings.estado'),
              t('settings.acciones'),
            ]}
          >
            {items.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Badge variant="primary">{t(REPORT_TYPE_KEYS[report.report_type])}</Badge>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{report.title}</TableCell>
                <TableCell className="text-gray-600">
                  {t(FREQUENCY_KEYS[report.frequency])}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {report.next_run_at ? formatDateTime(report.next_run_at) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={report.status === 'active' ? 'success' : 'neutral'}>
                    {report.status === 'active' ? t('settings.activo') : t('settings.inactivo')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(report)}
                      aria-label={`${t('settings.editar')} ${report.title}`}
                      title={t('settings.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(report)
                      }}
                      aria-label={`${t('settings.eliminar')} ${report.title}`}
                      title={t('settings.eliminar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('settings.editar-reporte') : t('settings.nuevo-reporte-programado')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('settings.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('settings.guardar-cambios') : t('settings.crear-reporte')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('settings.tipo-de-reporte')}
              required
              value={form.report_type}
              onChange={(event) =>
                setForm({ ...form, report_type: event.target.value as ReportType })
              }
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(REPORT_TYPE_KEYS[type])}
                </option>
              ))}
            </Select>
            <Select
              label={t('settings.frecuencia')}
              required
              value={form.frequency}
              onChange={(event) =>
                setForm({ ...form, frequency: event.target.value as ReportFrequency })
              }
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t(FREQUENCY_KEYS[frequency])}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label={t('settings.titulo')}
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder={t('settings.ej-ventas-semanales-por-vendedor')}
            error={formError ?? undefined}
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('settings.proxima-ejecucion')}
              type="datetime-local"
              value={form.next_run_at}
              onChange={(event) => setForm({ ...form, next_run_at: event.target.value })}
              hint={t('settings.opcional')}
            />
            <Select
              label={t('settings.estado')}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="active">{t('settings.activo')}</option>
              <option value="inactive">{t('settings.inactivo')}</option>
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('settings.eliminar-reporte')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('settings.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('settings.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('settings.eliminar-el-reporte')} <strong>{deleting?.title}</strong>?
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}
