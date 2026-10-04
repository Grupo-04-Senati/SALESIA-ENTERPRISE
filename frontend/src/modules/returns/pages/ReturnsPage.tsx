import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Ban, Check, Eye, PackageX, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import type { ButtonVariant } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useDataVersion } from '@/data/DataProvider'
import { useLang } from '@/i18n/i18n'
import { getState } from '@/data/store'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/formatters'
import {
  approveReturn,
  createReturn,
  deleteReturn,
  getReturn,
  listReturns,
  setReturnStatus,
  updateReturn,
} from '../services/returnService'
import type { ReturnInput, ReturnItem, ReturnLine, ReturnStatus, SalesReturn } from '../services/returnService'

/**
 * Devoluciones (FE-2 · /devoluciones).
 * Pestaña «Solicitudes»: CRUD con aprobación (repone stock) y rechazo.
 * Pestaña «Artículos devueltos»: detalle de una devolución con sus KPIs.
 */

const TAB_ITEMS = [
  { id: 'solicitudes', label: 'returns.solicitudes' },
  { id: 'articulos', label: 'returns.articulos-devueltos' },
]

const STATUS_BADGE: Record<ReturnStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'warning', label: 'returns.pendiente' },
  completed: { variant: 'success', label: 'returns.aprobada' },
  rejected: { variant: 'error', label: 'returns.rechazada' },
}

type ConfirmKind = 'approve' | 'reject' | 'delete'

const CONFIRM_COPY: Record<ConfirmKind, { title: string; action: string; variant: ButtonVariant }> = {
  approve: { title: 'returns.aprobar-devolucion', action: 'returns.aprobar', variant: 'primary' },
  reject: { title: 'returns.rechazar-devolucion', action: 'returns.rechazar', variant: 'danger' },
  delete: { title: 'returns.eliminar-devolucion', action: 'returns.eliminar', variant: 'danger' },
}

const EMPTY_FORM = { sale_id: '', reason: '' }

interface DraftLine {
  product_id: string
  quantity: string
}

const EMPTY_LINE: DraftLine = { product_id: '', quantity: '1' }

export default function ReturnsPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()

  const [tab, setTab] = useState('solicitudes')
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SalesReturn | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [lines, setLines] = useState<DraftLine[]>([EMPTY_LINE])
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<SalesReturn | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [action, setAction] = useState<{ kind: ConfirmKind; ret: SalesReturn } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<SalesReturn | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [selectedError, setSelectedError] = useState<string | null>(null)

  const sales = useMemo(() => getState().sales, [version])
  const products = useMemo(() => getState().products, [version])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listReturns()
      .then((items) => {
        if (!cancelled) setReturns(items)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t('returns.no-se-pudieron-cargar-las-devoluciones'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt, version])

  useEffect(() => {
    if (selectedId === '' && returns.length > 0) {
      setSelectedId(String(returns[0].id))
    }
    if (selectedId !== '' && !returns.some((entry) => entry.id === Number(selectedId))) {
      setSelectedId(returns.length > 0 ? String(returns[0].id) : '')
    }
  }, [returns, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    let cancelled = false
    setSelectedLoading(true)
    setSelectedError(null)
    getReturn(Number(selectedId))
      .then((entry) => {
        if (!cancelled) setSelected(entry)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSelected(null)
          setSelectedError(
            reason instanceof Error ? reason.message : t('returns.no-se-pudo-cargar-el-detalle-de-la-devolucion'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setSelectedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, attempt])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return returns.filter(
      (entry) =>
        term === '' ||
        entry.return_number.toLowerCase().includes(term) ||
        entry.sale_number.toLowerCase().includes(term) ||
        entry.reason.toLowerCase().includes(term),
    )
  }, [returns, search])

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === Number(form.sale_id)) ?? null,
    [sales, form.sale_id],
  )

  const productOptions = useMemo(() => {
    if (!selectedSale) return products
    const ids = new Set((selectedSale.items ?? []).map((item) => item.product_id))
    const filtered = products.filter((product) => ids.has(product.id))
    return filtered.length > 0 ? filtered : products
  }, [products, selectedSale])

  const reload = () => setAttempt((value) => value + 1)

  const priceOf = (productId: number): number => {
    const saleItem = (selectedSale?.items ?? []).find((item) => item.product_id === productId)
    if (saleItem) return saleItem.unit_price
    return products.find((product) => product.id === productId)?.sale_price ?? 0
  }

  const liveTotal = lines.reduce((total, line) => {
    if (!line.product_id) return total
    const quantity = Math.max(Number(line.quantity) || 0, 0)
    return total + quantity * priceOf(Number(line.product_id))
  }, 0)

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((previous) =>
      previous.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    )
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setLines([EMPTY_LINE])
    setFormError(null)
    setFormLoading(false)
    setFormOpen(true)
  }

  const openEdit = async (entry: SalesReturn) => {
    setEditing(entry)
    setForm({ sale_id: String(entry.sale_id), reason: entry.reason })
    setFormError(null)
    setFormLoading(true)
    setFormOpen(true)
    try {
      const full = await getReturn(entry.id)
      const items = full.items ?? []
      setLines(
        items.length > 0
          ? items.map((item) => ({
              product_id: String(item.product_id),
              quantity: String(item.quantity),
            }))
          : [EMPTY_LINE],
      )
    } catch (reason: unknown) {
      setLines([EMPTY_LINE])
      setFormError(
        reason instanceof Error ? reason.message : t('returns.no-se-pudo-cargar-el-detalle-de-la-devolucion-2'),
      )
    } finally {
      setFormLoading(false)
    }
  }

  const handleSubmit = async () => {
    const saleId = Number(form.sale_id)
    const reason = form.reason.trim()
    if (!saleId) {
      setFormError(t('returns.selecciona-una-venta-2'))
      return
    }
    if (reason.length < 3) {
      setFormError(t('returns.el-motivo-debe-tener-al-menos-3-caracteres'))
      return
    }
    const items: ReturnLine[] = []
    const seen = new Set<number>()
    for (const line of lines) {
      if (!line.product_id) continue
      const quantity = Math.max(Number(line.quantity) || 0, 0)
      if (quantity < 1) {
        setFormError(t('returns.cada-producto-debe-tener-una-cantidad-mayor-o-igual-a-1'))
        return
      }
      const productId = Number(line.product_id)
      if (seen.has(productId)) {
        setFormError(t('returns.cada-producto-solo-puede-aparecer-una-vez-en-la-devolucion'))
        return
      }
      seen.add(productId)
      items.push({ product_id: productId, quantity })
    }
    if (items.length === 0) {
      setFormError(t('returns.agrega-al-menos-un-producto-a-la-devolucion'))
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      const payload: ReturnInput = { sale_id: saleId, reason, items }
      if (editing) {
        await updateReturn(editing.id, payload)
        toast.success(
          t('returns.devolucion-actualizada'),
          `${editing.return_number} ${t('returns.se-guardo-correctamente')}`,
        )
      } else {
        const created = await createReturn(payload)
        toast.success(
          t('returns.devolucion-registrada'),
          created?.return_number
            ? `${created.return_number} ${t('returns.quedo-pendiente-de-aprobacion')}`
            : t('returns.la-solicitud-quedo-pendiente-de-aprobacion'),
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : t('returns.no-se-pudo-guardar-la-devolucion'))
    } finally {
      setSaving(false)
    }
  }

  const openDetail = (entry: SalesReturn) => {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setDetailOpen(true)
    getReturn(entry.id)
      .then((full) => setDetail(full))
      .catch((reason: unknown) =>
        setDetailError(
          reason instanceof Error ? reason.message : t('returns.no-se-pudo-cargar-el-detalle-de-la-devolucion'),
        ),
      )
      .finally(() => setDetailLoading(false))
  }

  const openAction = (kind: ConfirmKind, entry: SalesReturn) => {
    setActionError(null)
    setAction({ kind, ret: entry })
  }

  const handleAction = async () => {
    if (!action) return
    const { kind, ret } = action
    setActionError(null)
    setActionBusy(true)
    try {
      if (kind === 'approve') {
        await approveReturn(ret.id)
        toast.success(
          t('returns.devolucion-aprobada'),
          t('returns.el-stock-de-los-productos-devueltos-fue-repuesto'),
        )
      } else if (kind === 'reject') {
        await setReturnStatus(ret.id, 'rejected')
        toast.success(
          t('returns.devolucion-rechazada'),
          `${ret.return_number} ${t('returns.quedo-marcada-como-rechazada')}`,
        )
      } else {
        await deleteReturn(ret.id)
        toast.success(
          t('returns.devolucion-eliminada'),
          `${ret.return_number} ${t('returns.se-quito-del-listado')}`,
        )
      }
      setAction(null)
      reload()
    } catch (reason: unknown) {
      setActionError(
        reason instanceof Error ? reason.message : t('returns.no-se-pudo-completar-la-operacion'),
      )
    } finally {
      setActionBusy(false)
    }
  }

  const unitsReturned = selected?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0
  const amountReturned =
    selected?.items?.reduce(
      (total, item) => total + (item.subtotal ?? item.quantity * (item.unit_price ?? 0)),
      0,
    ) ?? 0

  const renderDetailTable = (items: ReturnItem[]) => (
    <DataTable
      headers={[t('returns.producto'), t('returns.cantidad'), t('returns.precio'), t('returns.subtotal')]}
    >
      {items.map((item, index) => (
        <TableRow key={item.id ?? `${item.product_id}-${index}`}>
          <TableCell className="font-medium text-gray-900">
            {item.product_name ?? `${t('returns.producto')} #${item.product_id}`}
          </TableCell>
          <TableCell>{formatNumber(item.quantity)}</TableCell>
          <TableCell>{formatCurrency(item.unit_price ?? 0)}</TableCell>
          <TableCell className="font-medium">
            {formatCurrency(item.subtotal ?? item.quantity * (item.unit_price ?? 0))}
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('returns.devoluciones')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">{t('returns.solicitudes-de-nota-de-credito')}</p>
      </div>

      <Tabs
        items={TAB_ITEMS.map((item) => ({ ...item, label: t(item.label) }))}
        value={tab}
        onChange={setTab}
        id="devoluciones"
      />

      <TabPanel tabId="solicitudes" active={tab === 'solicitudes'}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm text-gray-600">
              {returns.length === 0
                ? t('returns.aun-no-hay-solicitudes-de-devolucion')
                : `${formatNumber(returns.length)} ${t('returns.solicitud-es-registrada-s')}`}
            </p>
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t('returns.nueva-devolucion')}
            </Button>
          </div>

          <div className="card">
            <Input
              type="search"
              aria-label={t('returns.buscar-devoluciones')}
              placeholder={t('returns.buscar-por-devolucion-venta-o-motivo')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {error ? (
            <div className="card">
              <ErrorState
                description={error}
                action={
                  <Button variant="outline" onClick={reload}>
                    {t('returns.reintentar')}
                  </Button>
                }
              />
            </div>
          ) : loading && returns.length === 0 ? (
            <div className="card">
              <DataTable
                headers={[
                  t('returns.devolucion'),
                  t('returns.venta'),
                  t('returns.motivo'),
                  t('returns.total'),
                  t('returns.estado'),
                  '',
                ]}
              >
                <TableStateRow colSpan={6}>
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} className="text-loading" />
                    {t('returns.cargando-devoluciones')}
                  </span>
                </TableStateRow>
              </DataTable>
            </div>
          ) : visible.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Undo2}
                title={t('returns.sin-devoluciones')}
                description={t(
                  'returns.aun-no-hay-solicitudes-de-devolucion-crea-la-primera-para-devolver-productos-de-una-venta',
                )}
                action={
                  <Button onClick={openCreate}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {t('returns.nueva-devolucion')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <DataTable
                headers={[
                  t('returns.devolucion'),
                  t('returns.venta'),
                  t('returns.motivo'),
                  t('returns.total'),
                  t('returns.estado'),
                  t('returns.acciones'),
                ]}
              >
                {visible.map((entry) => {
                  const badge = STATUS_BADGE[entry.status]
                  const pending = entry.status === 'pending'
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium text-gray-900">{entry.return_number}</TableCell>
                      <TableCell className="text-gray-600">{entry.sale_number}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-gray-600">
                        <span title={entry.reason}>{entry.reason}</span>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(entry.total)}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{t(badge.label)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            label={`${t('returns.ver-detalle-de')} ${entry.return_number}`}
                            onClick={() => openDetail(entry)}
                          >
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          </ActionButton>
                          {pending && (
                            <>
                              <ActionButton
                                label={`${t('returns.editar')} ${entry.return_number}`}
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </ActionButton>
                              <ActionButton
                                label={`${t('returns.aprobar')} ${entry.return_number}`}
                                tone="success"
                                onClick={() => openAction('approve', entry)}
                              >
                                <Check aria-hidden="true" className="h-4 w-4" />
                              </ActionButton>
                              <ActionButton
                                label={`${t('returns.rechazar')} ${entry.return_number}`}
                                tone="error"
                                onClick={() => openAction('reject', entry)}
                              >
                                <Ban aria-hidden="true" className="h-4 w-4" />
                              </ActionButton>
                              <ActionButton
                                label={`${t('returns.eliminar')} ${entry.return_number}`}
                                tone="error"
                                onClick={() => openAction('delete', entry)}
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </ActionButton>
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
        </div>
      </TabPanel>

      <TabPanel tabId="articulos" active={tab === 'articulos'}>
        <div className="space-y-6">
          {returns.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={PackageX}
                title={t('returns.sin-devoluciones')}
                description={t(
                  'returns.cuando-existan-solicitudes-de-devolucion-aqui-veras-los-articulos-devueltos-de-cada-una',
                )}
              />
            </div>
          ) : (
            <>
              <div className="card">
                <Select
                  label={t('returns.devolucion')}
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  hint={t('returns.selecciona-una-devolucion-para-ver-sus-articulos')}
                >
                  <option value="">{t('returns.selecciona-una-devolucion')}</option>
                  {returns.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.return_number} · {entry.sale_number} · {formatCurrency(entry.total)}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedLoading ? (
                <div className="card">
                  <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
                    <Spinner size={16} className="text-loading" />
                    {t('returns.cargando-articulos')}
                  </p>
                </div>
              ) : selectedError ? (
                <div className="card">
                  <ErrorState description={selectedError} />
                </div>
              ) : !selected ? (
                <div className="card">
                  <EmptyState
                    icon={PackageX}
                    title={t('returns.elige-una-devolucion')}
                    description={t('returns.selecciona-una-devolucion-en-el-selector-para-ver-sus-articulos')}
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="card p-4">
                      <p className="text-caption text-gray-500">{t('returns.unidades-devueltas')}</p>
                      <p className="mt-1 text-h3 text-gray-900">{formatNumber(unitsReturned)}</p>
                      <p className="mt-1 text-caption text-gray-400">
                        {selected.return_number} · {selected.item_count} {t('returns.linea-s')}
                      </p>
                    </div>
                    <div className="card p-4">
                      <p className="text-caption text-gray-500">{t('returns.monto-total-devuelto')}</p>
                      <p className="mt-1 text-h3 text-primary">{formatCurrency(amountReturned)}</p>
                      <p className="mt-1 text-caption text-gray-400">
                        {t('returns.venta')} {selected.sale_number} ·{' '}
                        <Badge variant={STATUS_BADGE[selected.status].variant}>
                          {t(STATUS_BADGE[selected.status].label)}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  <div className="card">
                    {selected.items && selected.items.length > 0 ? (
                      renderDetailTable(selected.items)
                    ) : (
                      <EmptyState
                        icon={PackageX}
                        title={t('returns.sin-articulos')}
                        description={t('returns.esta-devolucion-no-tiene-articulos-registrados')}
                      />
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </TabPanel>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? t('returns.editar-devolucion') : t('returns.nueva-devolucion')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('returns.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={formLoading}>
              {editing ? t('returns.guardar-cambios') : t('returns.registrar-devolucion')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('returns.venta')}
            required
            value={form.sale_id}
            onChange={(event) => setForm({ ...form, sale_id: event.target.value })}
            hint={
              sales.length === 0
                ? t('returns.registra-ventas-en-el-menu-ventas')
                : t('returns.el-backend-valida-que-los-productos-pertenezcan-a-esta-venta')
            }
          >
            <option value="">{t('returns.selecciona-una-venta')}</option>
            {sales.map((sale) => (
              <option key={sale.id} value={sale.id}>
                {sale.sale_number} · {sale.customer.name} · {formatCurrency(sale.total)}
              </option>
            ))}
          </Select>

          <Textarea
            label={t('returns.motivo')}
            required
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder={t('returns.ej-producto-en-mal-estado-al-recibirlo')}
            hint={t('returns.minimo-3-caracteres')}
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm font-semibold text-gray-700">
                {t('returns.productos-devueltos')}
              </p>
              <p className="text-body-sm text-gray-600">
                {t('returns.total-estimado')}{' '}
                <strong className="text-primary">{formatCurrency(liveTotal)}</strong>
              </p>
            </div>

            {formLoading ? (
              <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
                <Spinner size={16} className="text-loading" />
                {t('returns.cargando-articulos-de-la-venta')}
              </p>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-7">
                      <Select
                        aria-label={t('returns.producto')}
                        value={line.product_id}
                        onChange={(event) => updateLine(index, { product_id: event.target.value })}
                      >
                        <option value="">{t('returns.producto-2')}</option>
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        aria-label={t('returns.cantidad')}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                    </div>
                    <div className="flex items-end justify-end sm:col-span-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((previous) =>
                            previous.length > 1
                              ? previous.filter((_, position) => position !== index)
                              : previous,
                          )
                        }
                        aria-label={t('returns.quitar-linea')}
                        title={t('returns.quitar-linea')}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-error"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((previous) => [...previous, EMPTY_LINE])}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {t('returns.agregar-linea')}
                </Button>
              </div>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {formError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          detail ? `${t('returns.devolucion')} ${detail.return_number}` : t('returns.detalle-de-la-devolucion')
        }
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setDetailOpen(false)}>
            {t('returns.cerrar')}
          </Button>
        }
      >
        {detailLoading ? (
          <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            {t('returns.cargando-detalle')}
          </p>
        ) : detailError ? (
          <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {detailError}
          </p>
        ) : detail ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('returns.venta')}</dt>
                <dd className="font-medium text-gray-900">{detail.sale_number}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('returns.estado')}</dt>
                <dd>
                  <Badge variant={STATUS_BADGE[detail.status].variant}>
                    {t(STATUS_BADGE[detail.status].label)}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('returns.total')}</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(detail.total)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-600">{t('returns.registrada')}</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(detail.created_at)}</dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-body-sm font-semibold text-gray-700">{t('returns.motivo')}</p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-body-sm text-gray-700">
                {detail.reason}
              </p>
            </div>

            {detail.items && detail.items.length > 0 ? (
              renderDetailTable(detail.items)
            ) : (
              <p className="text-body-sm text-gray-500">{t('returns.esta-devolucion-no-tiene-articulos')}</p>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={action !== null}
        onClose={() => !actionBusy && setAction(null)}
        title={action ? t(CONFIRM_COPY[action.kind].title) : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)} disabled={actionBusy}>
              {t('returns.cancelar')}
            </Button>
            <Button
              variant={action ? CONFIRM_COPY[action.kind].variant : 'primary'}
              loading={actionBusy}
              onClick={handleAction}
            >
              {action ? t(CONFIRM_COPY[action.kind].action) : ''}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {action?.kind === 'approve' && (
            <>
              {t('returns.aprobar-la-devolucion')}
              <strong>{action.ret.return_number}</strong>
              {t('returns.se-repondra-el-stock-de-sus-productos-y-la-solicitud-quedara-como-aprobada')}
            </>
          )}
          {action?.kind === 'reject' && (
            <>
              {t('returns.rechazar-la-devolucion')}
              <strong>{action.ret.return_number}</strong>
              {t('returns.quedara-marcada-como-rechazada-y-ya-no-se-podra-modificar')}
            </>
          )}
          {action?.kind === 'delete' && (
            <>
              {t('returns.eliminar-la-devolucion')}
              <strong>{action.ret.return_number}</strong>
              {t('returns.solo-es-posible-eliminar-las-solicitudes-pendientes')}
            </>
          )}
        </p>
        {actionError && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg"
          >
            {actionError}
          </p>
        )}
      </Modal>
    </div>
  )
}

interface ActionButtonProps {
  label: string
  tone?: 'default' | 'success' | 'error'
  onClick: () => void
  children: ReactNode
}

function ActionButton({ label, tone = 'default', onClick, children }: ActionButtonProps) {
  const tones = {
    default: 'text-gray-500 hover:bg-gray-100 hover:text-primary',
    success: 'text-gray-500 hover:bg-green-50 hover:text-success',
    error: 'text-gray-500 hover:bg-red-50 hover:text-error',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors',
        tones[tone],
      )}
    >
      {children}
    </button>
  )
}
