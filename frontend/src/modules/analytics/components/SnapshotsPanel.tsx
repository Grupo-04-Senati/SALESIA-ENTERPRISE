import { useEffect, useState } from 'react'
import { Camera, Plus, Trash2 } from 'lucide-react'
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
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/formatters'
import { createKpiSnapshot, deleteKpiSnapshot, listKpiSnapshots } from '../services/kpiService'
import type { KpiCode, KpiSnapshot } from '../services/kpiService'

/** Pestaña «Instantáneas» de Analytics (ENDPOINTS.kpiSnapshots). */

const KPI_CODES: KpiCode[] = ['revenue', 'sales_count', 'avg_ticket', 'customers', 'low_stock']

const CURRENCY_KPIS: KpiCode[] = ['revenue', 'avg_ticket']

const KPI_LABEL_KEYS: Record<KpiCode, string> = {
  revenue: 'analytics.ingresos',
  sales_count: 'analytics.n-de-ventas',
  avg_ticket: 'analytics.ticket-promedio',
  customers: 'analytics.clientes',
  low_stock: 'analytics.productos-con-stock-bajo',
}

const EMPTY_FORM = { kpi_code: 'revenue' as KpiCode, period_start: '', period_end: '' }

function formatValue(kpi: KpiCode, value: number): string {
  return CURRENCY_KPIS.includes(kpi) ? formatCurrency(value) : formatNumber(value)
}

export default function SnapshotsPanel() {
  const toast = useToast()
  const { t } = useLang()

  const kpiLabel = (code: KpiCode) => t(KPI_LABEL_KEYS[code])

  const [items, setItems] = useState<KpiSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<KpiSnapshot | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listKpiSnapshots()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('analytics.no-se-pudieron-cargar-las-instantaneas'),
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
    if (!form.period_start || !form.period_end) {
      setFormError(t('analytics.indica-la-fecha-de-inicio-y-la-fecha-de-fin-del-periodo'))
      return
    }
    if (form.period_end < form.period_start) {
      setFormError(t('analytics.la-fecha-de-fin-no-puede-ser-anterior-a-la-de-inicio'))
      return
    }
    setSaving(true)
    try {
      const created = await createKpiSnapshot(form)
      toast.success(
        t('analytics.instantanea-guardada'),
        `${kpiLabel(created.kpi_code)}: ${formatValue(created.kpi_code, created.value)}.`,
      )
      setFormOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('analytics.no-se-pudo-guardar-la-instantanea'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteKpiSnapshot(deleting.id)
      toast.success(t('analytics.instantanea-eliminada'), kpiLabel(deleting.kpi_code))
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : t('analytics.no-se-pudo-eliminar-la-instantanea'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('analytics.fotografias-de-un-kpi-en-un-periodo-el-backend-calcula-el-valor-al-guardarla')}
        </p>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM)
            setFormError(null)
            setFormOpen(true)
          }}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('analytics.guardar-instantanea')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('analytics.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('analytics.kpi'),
              t('analytics.periodo'),
              t('analytics.valor'),
              t('analytics.fecha'),
              '',
            ]}
          >
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('analytics.cargando-instantaneas')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Camera}
            title={t('analytics.sin-instantaneas')}
            description={t(
              'analytics.guarda-la-primera-instantanea-de-un-kpi-para-compararla-con-la-evolucion-de-los-siguientes-periodos',
            )}
            action={
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM)
                  setFormError(null)
                  setFormOpen(true)
                }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('analytics.guardar-instantanea')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('analytics.kpi'),
              t('analytics.periodo'),
              t('analytics.valor'),
              t('analytics.fecha'),
              t('analytics.acciones'),
            ]}
          >
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Badge variant="primary">{kpiLabel(row.kpi_code)}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-gray-600">
                  {row.period_start} → {row.period_end}
                </TableCell>
                <TableCell className="font-medium text-gray-900">
                  {formatValue(row.kpi_code, row.value)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(row)
                      }}
                      aria-label={t('analytics.eliminar-instantanea')}
                      title={t('analytics.eliminar')}
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
        title={t('analytics.guardar-instantanea')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('analytics.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {t('analytics.guardar-instantanea')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('analytics.kpi')}
            required
            value={form.kpi_code}
            onChange={(event) => setForm({ ...form, kpi_code: event.target.value as KpiCode })}
            error={formError ?? undefined}
          >
            {KPI_CODES.map((code) => (
              <option key={code} value={code}>
                {kpiLabel(code)}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('analytics.periodo-desde')}
              type="date"
              required
              value={form.period_start}
              onChange={(event) => setForm({ ...form, period_start: event.target.value })}
            />
            <Input
              label={t('analytics.periodo-hasta')}
              type="date"
              required
              value={form.period_end}
              onChange={(event) => setForm({ ...form, period_end: event.target.value })}
            />
          </div>
          <p className="text-caption text-gray-500">
            {t('analytics.el-valor-se-calcula-en-el-backend-con-los-datos-del-periodo-indicado')}
          </p>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('analytics.eliminar-instantanea')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('analytics.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('analytics.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('analytics.eliminar-la-instantanea-de')}{' '}
          <strong>{deleting ? kpiLabel(deleting.kpi_code) : ''}</strong>?
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
