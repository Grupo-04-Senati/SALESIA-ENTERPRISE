import { useEffect, useState } from 'react'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/utils/formatters'
import {
  cleanText,
  hasLetter,
  integer,
  maxDecimals,
  maxLength,
  minLength,
  numberRange,
} from '@/utils/validators'
import {
  createSegment,
  deleteSegment,
  listSegments,
  updateSegment,
} from '../services/segmentService'
import type { CustomerSegment, SegmentInput } from '../services/segmentService'
import { useLang } from '@/i18n/i18n'

/** Pestaña «Segmentos» de Clientes: segmentación RF-03 (ENDPOINTS.segments). */

const EMPTY_FORM = { name: '', description: '', min_purchases: '0', min_total: '0' }

export default function SegmentsPanel() {
  const { t } = useLang()
  const toast = useToast()

  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerSegment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<CustomerSegment | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSegments()
      .then((result) => {
        if (!cancelled) setSegments(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('customers.no-se-pudieron-cargar-los-segmentos'),
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

  const openEdit = (segment: CustomerSegment) => {
    setEditing(segment)
    setForm({
      name: segment.name,
      description: segment.description ?? '',
      min_purchases: String(segment.min_purchases),
      min_total: String(segment.min_total),
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const name = cleanText(form.name)
    const nameError =
      minLength(2, t('customers.el-nombre-debe-tener-al-menos-2-caracteres'))(name) ??
      maxLength(60)(name) ??
      hasLetter()(name)
    if (nameError) {
      setFormError(nameError)
      return
    }
    const descriptionError = maxLength(300)(form.description)
    if (descriptionError) {
      setFormError(descriptionError)
      return
    }
    const minPurchases = Number(form.min_purchases)
    const minTotal = Number(form.min_total)
    if (Number.isNaN(minPurchases) || minPurchases < 0) {
      setFormError(t('customers.las-minimas-compras-deben-ser-un-numero-mayor-o-igual-a-0'))
      return
    }
    if (Number.isNaN(minTotal) || minTotal < 0) {
      setFormError(t('customers.el-monto-minimo-debe-ser-un-numero-mayor-o-igual-a-0'))
      return
    }
    const minPurchasesError = integer(0, 999999)(form.min_purchases)
    if (minPurchasesError) {
      setFormError(minPurchasesError)
      return
    }
    const minTotalError =
      maxDecimals(2)(form.min_total) ?? numberRange(0, 100000000)(form.min_total)
    if (minTotalError) {
      setFormError(minTotalError)
      return
    }
    const input: SegmentInput = {
      name,
      description: cleanText(form.description) || null,
      min_purchases: minPurchases,
      min_total: minTotal,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSegment(editing.id, input)
        toast.success(
          t('customers.segmento-actualizado'),
          `${name} ${t('customers.se-guardo-correctamente')}`,
        )
      } else {
        await createSegment(input)
        toast.success(
          t('customers.segmento-creado'),
          `${name} ${t('customers.ya-esta-disponible-para-clasificar-clientes')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('customers.no-se-pudo-guardar-el-segmento'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteSegment(deleting.id)
      toast.success(
        t('customers.segmento-eliminado'),
        `${deleting.name} ${t('customers.se-quito-de-la-segmentacion')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : t('customers.no-se-pudo-eliminar-el-segmento'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('customers.segmentos-comerciales-con-umbrales-de-compra-clasifican-a-los-clientes-del-directorio')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('customers.nuevo-segmento')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('customers.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && segments.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('customers.segmento'), t('customers.descripcion'), t('customers.min-compras'), t('customers.min-monto'), t('customers.clientes'), t('customers.estado'), '']}>
            <TableStateRow colSpan={7}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('customers.cargando-segmentos')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : segments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title={t('customers.sin-segmentos')}
            description={t('customers.aun-no-hay-segmentos-crea-el-primero-para-empezar-a-clasificar-a-tus-clientes')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('customers.nuevo-segmento')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[t('customers.segmento'), t('customers.descripcion'), t('customers.min-compras'), t('customers.min-monto'), t('customers.clientes'), t('customers.estado'), t('customers.acciones')]}
          >
            {segments.map((segment) => (
              <TableRow key={segment.id}>
                <TableCell className="font-medium text-gray-900">{segment.name}</TableCell>
                <TableCell className="text-gray-600">{segment.description ?? '—'}</TableCell>
                <TableCell>{segment.min_purchases}</TableCell>
                <TableCell>{formatCurrency(segment.min_total)}</TableCell>
                <TableCell>{segment.customer_count}</TableCell>
                <TableCell>
                  <Badge variant={segment.status === 'inactive' ? 'neutral' : 'success'}>
                    {segment.status === 'inactive' ? t('customers.inactivo') : t('customers.activo')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(segment)}
                      aria-label={`${t('customers.editar')} ${segment.name}`}
                      title={t('customers.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(segment)
                      }}
                      aria-label={`${t('customers.eliminar')} ${segment.name}`}
                      title={t('customers.eliminar')}
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
        title={editing ? t('customers.editar-segmento') : t('customers.nuevo-segmento')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('customers.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('customers.guardar-cambios') : t('customers.crear-segmento')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('customers.nombre')}
            required
            minLength={2}
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={t('customers.ej-mayoristas')}
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label={t('customers.descripcion')}
            maxLength={300}
            hint={t('customers.opcional-describe-que-clientes-agrupa-este-segmento')}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder={t('customers.ej-clientes-con-volumen-de-compra-alto')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('customers.min-compras')}
              type="number"
              min={0}
              max={999999}
              step={1}
              value={form.min_purchases}
              onChange={(event) => setForm({ ...form, min_purchases: event.target.value })}
              hint={t('customers.compras-minimas-para-pertenecer')}
            />
            <Input
              label={t('customers.min-monto')}
              type="number"
              min={0}
              max={100000000}
              step="0.01"
              value={form.min_total}
              onChange={(event) => setForm({ ...form, min_total: event.target.value })}
              hint={t('customers.monto-acumulado-minimo-s')}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('customers.eliminar-segmento')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('customers.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('customers.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('customers.eliminar-el-segmento')} <strong>{deleting?.name}</strong>
          {t('customers.los-clientes-que-lo-usan-conservan-su-segmentacion-actual')}
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
