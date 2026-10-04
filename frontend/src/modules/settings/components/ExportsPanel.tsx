import { useEffect, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatDateTime, formatNumber } from '@/utils/formatters'
import {
  createDataExport,
  deleteDataExport,
  listDataExports,
} from '../services/systemService'
import type { DataExport, ExportFormat, ExportType } from '../services/systemService'

/** Pestaña «Exportaciones» de Configuración (ENDPOINTS.dataExports). */

const EXPORT_TYPES: ExportType[] = [
  'sales',
  'products',
  'customers',
  'inventory',
  'returns',
  'quotes',
]

const FORMATS: ExportFormat[] = ['csv', 'xlsx', 'json']

const EMPTY_FORM = { export_type: 'sales' as ExportType, format: 'csv' as ExportFormat }

const EXPORT_TYPE_KEYS: Record<ExportType, string> = {
  sales: 'settings.export-ventas',
  products: 'settings.export-productos',
  customers: 'settings.export-clientes',
  inventory: 'settings.export-inventario',
  returns: 'settings.export-devoluciones',
  quotes: 'settings.export-cotizaciones',
}

export default function ExportsPanel() {
  const toast = useToast()
  const { t } = useLang()

  const [items, setItems] = useState<DataExport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<DataExport | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listDataExports()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('settings.no-se-pudieron-cargar-las-exportaciones'),
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

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const created = await createDataExport(form)
      toast.success(
        t('settings.exportacion-generada'),
        `${t(EXPORT_TYPE_KEYS[created.export_type])} · ${created.format.toUpperCase()} ${t('settings.con')} ${formatNumber(created.row_count)} ${t('settings.filas-punto')}`,
      )
      setFormOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('settings.no-se-pudo-crear-la-exportacion'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteDataExport(deleting.id)
      toast.success(
        t('settings.exportacion-eliminada'),
        t('settings.se-quito-del-historial-de-exportaciones'),
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : t('settings.no-se-pudo-eliminar-la-exportacion'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">{t('settings.exporta-datos-del-negocio')}</p>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM)
            setFormError(null)
            setFormOpen(true)
          }}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('settings.nueva-exportacion')}
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
              t('settings.tipo'),
              t('settings.formato'),
              t('settings.filas'),
              t('settings.estado'),
              t('settings.fecha'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('settings.cargando-exportaciones')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Download}
            title={t('settings.sin-exportaciones')}
            description={t('settings.genera-la-primera-exportacion')}
            action={
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM)
                  setFormError(null)
                  setFormOpen(true)
                }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('settings.nueva-exportacion')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('settings.tipo'),
              t('settings.formato'),
              t('settings.filas'),
              t('settings.estado'),
              t('settings.fecha'),
              t('settings.acciones'),
            ]}
          >
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-gray-900">
                  {t(EXPORT_TYPE_KEYS[row.export_type])}
                </TableCell>
                <TableCell>
                  <Badge variant="primary">{row.format.toUpperCase()}</Badge>
                </TableCell>
                <TableCell>{formatNumber(row.row_count)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'completed' ? 'success' : 'warning'}>
                    {row.status === 'completed' ? t('settings.completada') : t('settings.en-proceso')}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(row)
                      }}
                      aria-label={t('settings.eliminar-exportacion')}
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
        title={t('settings.nueva-exportacion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('settings.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {t('settings.generar-exportacion')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('settings.tipo-de-dato')}
            required
            value={form.export_type}
            onChange={(event) =>
              setForm({ ...form, export_type: event.target.value as ExportType })
            }
            error={formError ?? undefined}
          >
            {EXPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(EXPORT_TYPE_KEYS[type])}
              </option>
            ))}
          </Select>
          <Select
            label={t('settings.formato')}
            required
            value={form.format}
            onChange={(event) => setForm({ ...form, format: event.target.value as ExportFormat })}
          >
            {FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </Select>
          <p className="text-caption text-gray-500">
            {t('settings.el-backend-calcula-el-numero-real-de-filas')}
          </p>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('settings.eliminar-exportacion')}
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
          {t('settings.eliminar-la-exportacion-de')}{' '}
          <strong>{deleting ? t(EXPORT_TYPE_KEYS[deleting.export_type]) : ''}</strong>?
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
