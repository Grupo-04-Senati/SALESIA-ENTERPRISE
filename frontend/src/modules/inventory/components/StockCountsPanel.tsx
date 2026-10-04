import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Eye, Check, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatDateTime } from '@/utils/formatters'
import { getState } from '@/data/store'
import { useDataVersion } from '@/data/DataProvider'
import {
  confirmStockCount,
  createStockCount,
  deleteStockCount,
  getStockCount,
  listStockCounts,
} from '../services/stockCountService'
import type { StockCount, StockCountDetail } from '../services/stockCountService'
import { listWarehouses } from '../services/warehouseService'
import type { Warehouse } from '../services/warehouseService'

/** Pestaña «Conteos» de Inventario: conteos cíclicos (ENDPOINTS.stockCounts). */

const STATUS_BADGES: Record<
  StockCount['status'],
  { variant: 'warning' | 'success'; labelKey: string }
> = {
  draft: { variant: 'warning', labelKey: 'inventory.borrador' },
  done: { variant: 'success', labelKey: 'inventory.confirmado' },
}

interface Line {
  product_id: string
  counted_qty: string
}

const EMPTY_FORM = { warehouse_id: '', notes: '', lines: [{ product_id: '', counted_qty: '0' }] as Line[] }

export default function StockCountsPanel() {
  const { t } = useLang()
  const toast = useToast()
  const version = useDataVersion()
  const products = useMemo(() => getState().products, [version])

  const [counts, setCounts] = useState<StockCount[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<StockCountDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBusy, setDetailBusy] = useState(false)
  const detailRequest = useRef(0)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState<StockCount | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([listStockCounts(), listWarehouses()])
      .then(([countRows, warehouseRows]) => {
        if (cancelled) return
        setCounts(countRows)
        setWarehouses(warehouseRows)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t('inventory.no-se-pudieron-cargar-los-conteos'),
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
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const setLine = (index: number, patch: Partial<Line>) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, position) =>
        position === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const handleSubmit = async () => {
    const warehouseId = Number(form.warehouse_id)
    if (!warehouseId) {
      setFormError(t('inventory.selecciona-el-almacen-a-contar'))
      return
    }
    if (form.lines.length === 0) {
      setFormError(t('inventory.agrega-al-menos-un-producto-al-conteo'))
      return
    }
    const items = form.lines.map((line) => ({
      product_id: Number(line.product_id),
      counted_qty: Number(line.counted_qty),
    }))
    if (items.some((item) => !item.product_id)) {
      setFormError(t('inventory.selecciona-el-producto-de-cada-linea'))
      return
    }
    if (items.some((item) => Number.isNaN(item.counted_qty) || item.counted_qty < 0)) {
      setFormError(t('inventory.la-cantidad-contada-debe-ser-un-numero-mayor-o-igual-a-0'))
      return
    }
    setSaving(true)
    try {
      const created = await createStockCount({
        warehouse_id: warehouseId,
        notes: form.notes.trim() || null,
        items,
      })
      toast.success(t('inventory.conteo-creado'), `${created.count_number} ${t('inventory.quedo-en-borrador')}`)
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-crear-el-conteo'),
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (count: StockCount) => {
    const requestId = ++detailRequest.current
    setDetailOpen(true)
    setDetailBusy(true)
    setDetail(null)
    try {
      const data = await getStockCount(count.id)
      if (detailRequest.current === requestId) setDetail(data)
    } catch (reason: unknown) {
      if (detailRequest.current === requestId) {
        toast.error(
          t('inventory.no-se-pudo-abrir-el-conteo'),
          reason instanceof Error ? reason.message : t('inventory.error-inesperado'),
        )
        setDetailOpen(false)
      }
    } finally {
      if (detailRequest.current === requestId) setDetailBusy(false)
    }
  }

  const closeDetail = () => {
    detailRequest.current += 1
    setDetailOpen(false)
    setDetailBusy(false)
    setDetail(null)
  }

  const handleConfirm = async () => {
    if (!detail) return
    setConfirming(true)
    try {
      await confirmStockCount(detail.id)
      toast.success(
        t('inventory.conteo-confirmado'),
        t('inventory.los-ajustes-de-diferencia-se-aplicaron-al-inventario'),
      )
      closeDetail()
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('inventory.no-se-pudo-confirmar'),
        reason instanceof Error ? reason.message : t('inventory.error-inesperado'),
      )
    } finally {
      setConfirming(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteStockCount(deleting.id)
      toast.success(t('inventory.conteo-eliminado'), `${deleting.count_number} ${t('inventory.se-descarto')}`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-eliminar-el-conteo'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t(
            'inventory.conteo-ciclico-por-almacen-registra-las-cantidades-contadas-y-confirma-para-ajustar-el-stock',
          )}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('inventory.nuevo-conteo')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('inventory.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && counts.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('inventory.conteo'),
              t('inventory.almacen'),
              t('inventory.items'),
              t('inventory.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('inventory.cargando-conteos')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : counts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={t('inventory.sin-conteos')}
            description={t(
              'inventory.aun-no-hay-conteos-de-inventario-crea-el-primero-para-comparar-lo-esperado-con-lo-contado',
            )}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('inventory.nuevo-conteo')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('inventory.conteo'),
              t('inventory.almacen'),
              t('inventory.items'),
              t('inventory.estado'),
              t('inventory.acciones'),
            ]}
          >
            {counts.map((count) => {
              const badge = STATUS_BADGES[count.status]
              return (
                <TableRow key={count.id}>
                  <TableCell>
                    <div className="font-mono font-medium text-gray-900">{count.count_number}</div>
                    <div className="text-caption text-gray-500">
                      {formatDateTime(count.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{count.warehouse_name}</TableCell>
                  <TableCell>{count.item_count}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{t(badge.labelKey)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openDetail(count)}
                        aria-label={`${t('inventory.ver')} ${count.count_number}`}
                        title={t('inventory.ver-detalle')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {count.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleting(count)
                            }}
                            aria-label={`${t('inventory.eliminar')} ${count.count_number}`}
                            title={t('inventory.eliminar')}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </DataTable>
        </div>
      )}

      {/* Nuevo conteo */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t('inventory.nuevo-conteo')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('inventory.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {t('inventory.crear-conteo')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('inventory.almacen')}
            required
            value={form.warehouse_id}
            onChange={(event) => setForm({ ...form, warehouse_id: event.target.value })}
            error={formError ?? undefined}
          >
            <option value="">{t('inventory.selecciona-un-almacen')}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </Select>

          <Textarea
            label={t('inventory.notas')}
            hint={t('inventory.opcional-observaciones-del-conteo')}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder={t('inventory.ej-conteo-mensual-del-almacen-central')}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-medium text-gray-700">
                {t('inventory.productos-contados')}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    lines: [...previous.lines, { product_id: '', counted_qty: '0' }],
                  }))
                }
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('inventory.agregar-linea')}
              </Button>
            </div>

            {form.lines.map((line, index) => {
              const product = products.find((entry) => entry.id === Number(line.product_id))
              return (
                <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
                  <div className="min-w-52 flex-1">
                    <Select
                      label={t('inventory.producto')}
                      value={line.product_id}
                      onChange={(event) => setLine(index, { product_id: event.target.value })}
                    >
                      <option value="">{t('inventory.selecciona-un-producto-2')}</option>
                      {products.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.sku} · {entry.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-36">
                    <Input
                      label={t('inventory.contado')}
                      type="number"
                      min={0}
                      step={1}
                      value={line.counted_qty}
                      onChange={(event) => setLine(index, { counted_qty: event.target.value })}
                    />
                  </div>
                  <p className="pb-2.5 text-caption text-gray-500">
                    {t('inventory.esperado-2')}{' '}
                    <span className="font-semibold text-gray-700">
                      {product ? product.current_stock : '—'}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        lines: previous.lines.filter((_, position) => position !== index),
                      }))
                    }
                    aria-label={t('inventory.quitar-linea')}
                    title={t('inventory.quitar-linea')}
                    className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* Detalle del conteo */}
      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={detail ? `${t('inventory.conteo')} ${detail.count_number}` : t('inventory.conteo')}
        size="lg"
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={closeDetail}>
                {t('inventory.cerrar')}
              </Button>
              {detail.status === 'draft' && (
                <Button onClick={handleConfirm} loading={confirming}>
                  <Check aria-hidden="true" className="h-4 w-4" />
                  {t('inventory.confirmar-conteo')}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {detailBusy || !detail ? (
          <p className="flex items-center justify-center gap-2 py-8 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            {t('inventory.cargando-detalle')}
          </p>
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('inventory.almacen')}</dt>
                <dd className="font-medium text-gray-900">{detail.warehouse_name}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('inventory.estado')}</dt>
                <dd>
                  <Badge variant={STATUS_BADGES[detail.status].variant}>
                    {t(STATUS_BADGES[detail.status].labelKey)}
                  </Badge>
                </dd>
              </div>
            </dl>
            <DataTable
              headers={[
                t('inventory.producto'),
                t('inventory.esperado'),
                t('inventory.contado'),
                t('inventory.diferencia'),
              ]}
            >
              {detail.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-gray-900">{item.product_name}</TableCell>
                  <TableCell>{item.expected_qty}</TableCell>
                  <TableCell>{item.counted_qty}</TableCell>
                  <TableCell
                    className={
                      item.difference === 0 ? 'text-gray-600' : 'font-semibold text-error'
                    }
                  >
                    {item.difference > 0 ? `+${item.difference}` : item.difference}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </div>
        )}
      </Modal>

      {/* Eliminar conteo */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('inventory.eliminar-conteo')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('inventory.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('inventory.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('inventory.eliminar-el-conteo')} <strong>{deleting?.count_number}</strong>?{' '}
          {t('inventory.solo-se-pueden-eliminar-los-conteos-en-borrador')}
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
