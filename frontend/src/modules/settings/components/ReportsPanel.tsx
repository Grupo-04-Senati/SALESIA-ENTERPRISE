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
import { formatDateTime } from '@/utils/formatters'
import {
  FREQUENCY_LABELS,
  REPORT_TYPE_LABELS,
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
            reason instanceof Error ? reason.message : 'No se pudieron cargar los reportes',
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
      setFormError('El título debe tener al menos 3 caracteres.')
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
        toast.success('Reporte actualizado', `${title} se guardó correctamente.`)
      } else {
        await createScheduledReport(input)
        toast.success('Reporte programado', `${title} quedó en el calendario.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el reporte.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteScheduledReport(deleting.id)
      toast.success('Reporte eliminado', `${deleting.title} se quitó del calendario.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el reporte.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Reportes que se generan solos con la frecuencia que indiques.
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo reporte
        </Button>
      </div>

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
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable headers={['Reporte', 'Título', 'Frecuencia', 'Próxima ejecución', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando reportes…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="Sin reportes programados"
            description="Programa tu primer reporte para recibirlo con la periodicidad que necesites."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo reporte
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={['Reporte', 'Título', 'Frecuencia', 'Próxima ejecución', 'Estado', 'Acciones']}
          >
            {items.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Badge variant="primary">{REPORT_TYPE_LABELS[report.report_type]}</Badge>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{report.title}</TableCell>
                <TableCell className="text-gray-600">
                  {FREQUENCY_LABELS[report.frequency]}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {report.next_run_at ? formatDateTime(report.next_run_at) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={report.status === 'active' ? 'success' : 'neutral'}>
                    {report.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(report)}
                      aria-label={`Editar ${report.title}`}
                      title="Editar"
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
                      aria-label={`Eliminar ${report.title}`}
                      title="Eliminar"
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
        title={editing ? 'Editar reporte' : 'Nuevo reporte programado'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear reporte'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de reporte"
              required
              value={form.report_type}
              onChange={(event) =>
                setForm({ ...form, report_type: event.target.value as ReportType })
              }
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              label="Frecuencia"
              required
              value={form.frequency}
              onChange={(event) =>
                setForm({ ...form, frequency: event.target.value as ReportFrequency })
              }
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Título"
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Ej. Ventas semanales por vendedor"
            error={formError ?? undefined}
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Próxima ejecución"
              type="datetime-local"
              value={form.next_run_at}
              onChange={(event) => setForm({ ...form, next_run_at: event.target.value })}
              hint="Opcional"
            />
            <Select
              label="Estado"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar reporte"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar el reporte <strong>{deleting?.title}</strong>?
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
