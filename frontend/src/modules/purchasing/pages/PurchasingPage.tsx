import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Eye, Package, Pencil, Plus, RefreshCw, Trash2, Truck, Users } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
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
import { formatCurrency, formatDateTime } from '@/utils/formatters'
import {
  cleanText,
  digitsBetween,
  email,
  hasLetter,
  maxDecimals,
  maxLength,
  pattern,
  phone,
} from '@/utils/validators'
import {
  createPurchaseOrder,
  createShipment,
  createSupplier,
  deletePurchaseOrder,
  deleteShipment,
  deleteSupplier,
  getPurchaseOrder,
  listPurchaseOrders,
  listShipments,
  listSuppliers,
  setPurchaseOrderStatus,
  setShipmentStatus,
  updatePurchaseOrder,
  updateShipment,
  updateSupplier,
} from '../services/purchaseService'
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Shipment,
  ShipmentStatus,
  Supplier,
} from '../services/purchaseService'

/**
 * Página de Compras (FE-1): barra de pestañas con Proveedores,
 * Órdenes de compra y Envíos, cada uno con su CRUD completo.
 */

const TAB_ITEMS = [
  { id: 'proveedores', label: 'purchasing.proveedores' },
  { id: 'ordenes', label: 'purchasing.ordenes-de-compra' },
  { id: 'envios', label: 'purchasing.envios' },
]

const PO_STATUS: Record<PurchaseOrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'purchasing.pendiente', variant: 'warning' },
  approved: { label: 'purchasing.aprobada', variant: 'info' },
  received: { label: 'purchasing.recibida', variant: 'success' },
  cancelled: { label: 'purchasing.cancelada', variant: 'error' },
}

const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

const PO_TRANSITION_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: 'purchasing.pendiente',
  approved: 'purchasing.aprobar',
  received: 'purchasing.marcar-recibida',
  cancelled: 'purchasing.cancelar',
}

const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'purchasing.pendiente', variant: 'warning' },
  shipped: { label: 'purchasing.enviado', variant: 'info' },
  delivered: { label: 'purchasing.entregado', variant: 'success' },
  cancelled: { label: 'purchasing.cancelado', variant: 'error' },
}

const EMPTY_SUPPLIER_FORM = { ruc: '', name: '', email: '', phone: '', address: '' }

function RowButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors ${
        tone === 'danger'
          ? 'hover:bg-red-50 hover:text-error'
          : 'hover:bg-gray-100 hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export default function PurchasingPage() {
  const [tab, setTab] = useState('proveedores')
  const { t } = useLang()

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('purchasing.compras')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">{t('purchasing.pagina-lead')}</p>
      </div>

      <Tabs
        items={TAB_ITEMS.map((item) => ({ ...item, label: t(item.label) }))}
        value={tab}
        onChange={setTab}
        id="compras"
      />

      <TabPanel tabId="proveedores" active={tab === 'proveedores'}>
        <ProveedoresTab />
      </TabPanel>
      <TabPanel tabId="ordenes" active={tab === 'ordenes'}>
        <OrdenesTab />
      </TabPanel>
      <TabPanel tabId="envios" active={tab === 'envios'}>
        <EnviosTab />
      </TabPanel>
    </div>
  )
}

/* ------------------------------------------------------------------
   Proveedores
   ------------------------------------------------------------------ */

function ProveedoresTab() {
  const toast = useToast()
  const version = useDataVersion()
  const { t } = useLang()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(EMPTY_SUPPLIER_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSuppliers()
      .then((result) => {
        if (!cancelled) setSuppliers(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'purchasing.no-se-pudieron-cargar-proveedores',
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return suppliers.filter(
      (supplier) =>
        term === '' ||
        supplier.name.toLowerCase().includes(term) ||
        supplier.ruc.includes(term),
    )
  }, [suppliers, search])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_SUPPLIER_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm({
      ruc: supplier.ruc,
      name: supplier.name,
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ruc = form.ruc.trim()
    const name = cleanText(form.name)
    const emailValue = form.email.trim()
    const phoneValue = form.phone.trim()
    const address = cleanText(form.address)
    if (digitsBetween(8, 15)(ruc)) {
      setFormError('purchasing.ruc-digitos')
      return
    }
    if (name.length < 2) {
      setFormError('purchasing.nombre-minimo')
      return
    }
    const nameMaxError = maxLength(150, 'El nombre debe tener como máximo 150 caracteres.')(name)
    if (nameMaxError) {
      setFormError(nameMaxError)
      return
    }
    const nameLetterError = hasLetter()(name)
    if (nameLetterError) {
      setFormError(nameLetterError)
      return
    }
    const emailMaxError = maxLength(160, 'El correo debe tener como máximo 160 caracteres.')(
      emailValue,
    )
    if (emailMaxError) {
      setFormError(emailMaxError)
      return
    }
    const emailError = email()(emailValue)
    if (emailError) {
      setFormError(emailError)
      return
    }
    const phoneMaxError = maxLength(20, 'El teléfono debe tener como máximo 20 caracteres.')(
      phoneValue,
    )
    if (phoneMaxError) {
      setFormError(phoneMaxError)
      return
    }
    const phoneError = phone()(phoneValue)
    if (phoneError) {
      setFormError(phoneError)
      return
    }
    const addressMaxError = maxLength(
      255,
      'La dirección debe tener como máximo 255 caracteres.',
    )(address)
    if (addressMaxError) {
      setFormError(addressMaxError)
      return
    }
    const input = {
      ruc,
      name,
      email: emailValue || null,
      phone: phoneValue || null,
      address: address || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSupplier(editing.id, input)
        toast.success(
          t('purchasing.proveedor-actualizado'),
          `${name} ${t('purchasing.se-guardo-correctamente')}`,
        )
      } else {
        await createSupplier(input)
        toast.success(
          t('purchasing.proveedor-creado'),
          `${name} ${t('purchasing.ya-esta-disponible-en-ordenes')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-guardar-proveedor',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    setDeleteError(null)
    try {
      await deleteSupplier(deleting.id)
      toast.success(
        t('purchasing.proveedor-eliminado'),
        `${deleting.name} ${t('purchasing.se-quito-del-directorio')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-eliminar-proveedor',
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">{t('purchasing.proveedores')}</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('purchasing.nuevo-proveedor')}
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label={t('purchasing.buscar-proveedores')}
          placeholder={t('purchasing.buscar-nombre-o-ruc')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={t(error)}
            action={
              <Button variant="outline" onClick={reload}>
                {t('purchasing.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && suppliers.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('purchasing.proveedor'), 'RUC', t('purchasing.contacto'), t('purchasing.estado'), '']}>
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('purchasing.cargando-proveedores')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={t('purchasing.sin-proveedores')}
            description={t('purchasing.sin-proveedores-desc')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('purchasing.nuevo-proveedor')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('purchasing.proveedor'),
              'RUC',
              t('purchasing.contacto'),
              t('purchasing.estado'),
              t('purchasing.acciones'),
            ]}
          >
            {visible.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell>
                  <div className="font-medium text-gray-900">{supplier.name}</div>
                  <div className="text-caption text-gray-500">{supplier.address ?? '—'}</div>
                </TableCell>
                <TableCell className="font-mono">{supplier.ruc}</TableCell>
                <TableCell>
                  <div className="text-gray-600">{supplier.email ?? '—'}</div>
                  <div className="text-caption text-gray-500">{supplier.phone ?? '—'}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={supplier.status === 'inactive' ? 'neutral' : 'success'}>
                    {supplier.status === 'inactive' ? t('purchasing.inactivo') : t('purchasing.activo')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton
                      label={`${t('purchasing.editar')} ${supplier.name}`}
                      onClick={() => openEdit(supplier)}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`${t('purchasing.eliminar')} ${supplier.name}`}
                      tone="danger"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(supplier)
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
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
        title={
          editing ? t('purchasing.editar-proveedor') : t('purchasing.nuevo-proveedor')
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('purchasing.cancelar')}
            </Button>
            <Button type="submit" form="supplier-form" loading={saving}>
              {editing ? t('purchasing.guardar-cambios') : t('purchasing.crear-proveedor')}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="RUC"
              required
              inputMode="numeric"
              minLength={8}
              maxLength={15}
              value={form.ruc}
              onChange={(event) => setForm({ ...form, ruc: event.target.value })}
              placeholder={t('purchasing.ej-ruc')}
              autoFocus
            />
            <Input
              label={t('purchasing.nombre')}
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={t('purchasing.ej-nombre')}
            />
            <Input
              label={t('purchasing.correo')}
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder={t('purchasing.ej-correo')}
            />
            <Input
              label={t('purchasing.telefono')}
              maxLength={20}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder={t('purchasing.ej-telefono')}
            />
          </div>
          <Textarea
            label={t('purchasing.direccion')}
            hint={t('purchasing.opcional')}
            maxLength={255}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder={t('purchasing.ej-direccion')}
          />
          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {t(formError)}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('purchasing.eliminar-proveedor')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              {t('purchasing.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              {t('purchasing.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('purchasing.eliminar-proveedor-prefijo')} <strong>{deleting?.name}</strong> (
          {t('purchasing.ruc')} {deleting?.ruc})? {t('purchasing.eliminar-proveedor-sufijo')}
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {t(deleteError)}
          </p>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------
   Órdenes de compra
   ------------------------------------------------------------------ */

function OrdenesTab() {
  const toast = useToast()
  const version = useDataVersion()
  const { t } = useLang()
  const allProducts = useMemo(() => getState().products, [version])
  const products = useMemo(
    () => allProducts.filter((product) => product.status === 'active'),
    [allProducts],
  )

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseOrderLine[]>([])
  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [lineCost, setLineCost] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<PurchaseOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [statusOrder, setStatusOrder] = useState<PurchaseOrder | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listPurchaseOrders()
      .then((result) => {
        if (!cancelled) setOrders(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'purchasing.no-se-pudieron-cargar-ordenes',
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
    let cancelled = false
    listSuppliers()
      .then((result) => {
        if (!cancelled) setSuppliers(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter(
      (order) =>
        term === '' ||
        order.order_number.toLowerCase().includes(term) ||
        order.supplier_name.toLowerCase().includes(term),
    )
  }, [orders, search])

  const lineTotal = lines.reduce(
    (total, line) => total + line.quantity * line.unit_cost,
    0,
  )

  const reload = () => setAttempt((value) => value + 1)

  const productName = (productId: number): string =>
    allProducts.find((product) => product.id === productId)?.name ??
    `${t('purchasing.producto-num')}${productId}`

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
  }

  const openCreate = () => {
    setEditing(null)
    setSupplierId('')
    setNotes('')
    setLines([])
    setLineProductId('')
    setLineQuantity('1')
    setLineCost('0')
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = async (order: PurchaseOrder) => {
    setFormError(null)
    try {
      const full = await getPurchaseOrder(order.id)
      setEditing(full)
      setSupplierId(String(full.supplier_id))
      setNotes(full.notes ?? '')
      setLines(
        (full.items ?? []).map(({ product_id, quantity, unit_cost }) => ({
          product_id,
          quantity,
          unit_cost,
        })),
      )
      setLineProductId('')
      setLineQuantity('1')
      setLineCost('0')
      setFormOpen(true)
    } catch (reason: unknown) {
      toast.error(
        t('purchasing.no-se-pudo-cargar-orden'),
        reason instanceof Error ? reason.message : t('purchasing.error-inesperado'),
      )
    }
  }

  const addLine = () => {
    const product = products.find((entry) => entry.id === Number(lineProductId))
    if (!product) {
      setFormError('purchasing.selecciona-producto-para-item')
      return
    }
    if (lines.some((line) => line.product_id === product.id)) {
      setFormError('purchasing.producto-ya-en-orden')
      return
    }
    const quantityRaw = lineQuantity.trim()
    const quantityValue = Number(lineQuantity)
    if (quantityRaw !== '' && (!Number.isInteger(quantityValue) || quantityValue > 999999)) {
      setFormError('La cantidad debe ser un número entero como máximo 999999.')
      return
    }
    const quantity = Math.max(quantityValue || 0, 1)
    const unitCost = Number(lineCost)
    if (Number.isNaN(unitCost) || unitCost < 0) {
      setFormError('purchasing.costo-unitario-invalido')
      return
    }
    const costDecimalsError = maxDecimals(2)(lineCost)
    if (costDecimalsError) {
      setFormError(costDecimalsError)
      return
    }
    if (unitCost > 100000000) {
      setFormError('El costo unitario no puede superar 100000000.')
      return
    }
    setLines((previous) => [...previous, { product_id: product.id, quantity, unit_cost: unitCost }])
    setLineProductId('')
    setLineQuantity('1')
    setLineCost('0')
    setFormError(null)
  }

  const removeLine = (productId: number) => {
    setLines((previous) => previous.filter((line) => line.product_id !== productId))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supplierId) {
      setFormError('purchasing.selecciona-proveedor')
      return
    }
    if (lines.length === 0) {
      setFormError('purchasing.agrega-al-menos-un-item')
      return
    }
    const notesValue = cleanText(notes)
    const notesMaxError = maxLength(500, 'Las notas no pueden superar 500 caracteres.')(notesValue)
    if (notesMaxError) {
      setFormError(notesMaxError)
      return
    }
    setFormError(null)
    setSaving(true)
    const input = {
      supplier_id: Number(supplierId),
      notes: notesValue || null,
      items: lines.map((line) => ({ ...line })),
    }
    try {
      if (editing) {
        await updatePurchaseOrder(editing.id, input)
        toast.success(
          t('purchasing.orden-actualizada'),
          `${editing.order_number} ${t('purchasing.se-guardo-correctamente')}`,
        )
      } else {
        const created = await createPurchaseOrder(input)
        toast.success(
          t('purchasing.orden-creada'),
          `${created.order_number} ${t('purchasing.registrada-por')} ${formatCurrency(created.total)}.`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-guardar-orden',
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetail = (order: PurchaseOrder) => {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setDetailId(order.id)
    getPurchaseOrder(order.id)
      .then((full) => setDetail(full))
      .catch((reason: unknown) =>
        setDetailError(
          reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-cargar-detalle-orden',
        ),
      )
      .finally(() => setDetailLoading(false))
  }

  const closeDetail = () => {
    setDetailId(null)
    setDetail(null)
    setDetailError(null)
  }

  const handleStatus = async (status: PurchaseOrderStatus) => {
    if (!statusOrder) return
    setStatusBusy(true)
    try {
      await setPurchaseOrderStatus(statusOrder.id, status)
      toast.success(
        status === 'received' ? t('purchasing.orden-recibida') : t('purchasing.estado-actualizado'),
        status === 'received'
          ? t('purchasing.stock-actualizado')
          : `${statusOrder.order_number} ${t('purchasing.paso-a')} «${t(PO_STATUS[status].label)}».`,
      )
      setStatusOrder(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('purchasing.no-se-pudo-cambiar-estado'),
        reason instanceof Error ? reason.message : t('purchasing.error-inesperado'),
      )
    } finally {
      setStatusBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    setDeleteError(null)
    try {
      await deletePurchaseOrder(deleting.id)
      toast.success(
        t('purchasing.orden-eliminada'),
        `${deleting.order_number} ${t('purchasing.se-elimino-del-listado')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-eliminar-orden',
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">{t('purchasing.ordenes-de-compra')}</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('purchasing.nueva-orden')}
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label={t('purchasing.buscar-ordenes')}
          placeholder={t('purchasing.buscar-numero-o-proveedor')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={t(error)}
            action={
              <Button variant="outline" onClick={reload}>
                {t('purchasing.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('purchasing.orden'),
              t('purchasing.proveedor'),
              t('purchasing.items'),
              t('purchasing.total'),
              t('purchasing.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('purchasing.cargando-ordenes')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title={t('purchasing.sin-ordenes')}
            description={t('purchasing.sin-ordenes-desc')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('purchasing.nueva-orden')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('purchasing.orden'),
              t('purchasing.proveedor'),
              t('purchasing.items'),
              t('purchasing.total'),
              t('purchasing.estado'),
              t('purchasing.acciones'),
            ]}
          >
            {visible.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-caption">{order.order_number}</TableCell>
                <TableCell className="font-medium text-gray-900">{order.supplier_name}</TableCell>
                <TableCell>{order.item_count}</TableCell>
                <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                <TableCell>
                  <Badge variant={PO_STATUS[order.status].variant}>
                    {t(PO_STATUS[order.status].label)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton
                      label={`${t('purchasing.ver-detalle-de')} ${order.order_number}`}
                      onClick={() => openDetail(order)}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`${t('purchasing.cambiar-estado-de')} ${order.order_number}`}
                      onClick={() => setStatusOrder(order)}
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    {order.status === 'pending' && (
                      <>
                        <RowButton
                          label={`${t('purchasing.editar')} ${order.order_number}`}
                          onClick={() => openEdit(order)}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </RowButton>
                        <RowButton
                          label={`${t('purchasing.eliminar')} ${order.order_number}`}
                          tone="danger"
                          onClick={() => {
                            setDeleteError(null)
                            setDeleting(order)
                          }}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </RowButton>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={
          editing
            ? `${t('purchasing.editar')} ${editing.order_number}`
            : t('purchasing.nueva-orden-de-compra')
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              {t('purchasing.cancelar')}
            </Button>
            <Button type="submit" form="order-form" loading={saving}>
              {editing ? t('purchasing.guardar-cambios') : t('purchasing.crear-orden')}
            </Button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('purchasing.proveedor')}
              required
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              hint={
                suppliers.length === 0 ? t('purchasing.hint-crea-proveedores') : undefined
              }
            >
              <option value="">{t('purchasing.selecciona-proveedor-opcion')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · {t('purchasing.ruc')} {supplier.ruc}
                </option>
              ))}
            </Select>
            <Textarea
              label={t('purchasing.notas')}
              hint={t('purchasing.hint-notas')}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('purchasing.ej-notas')}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-body-sm font-semibold text-gray-700">
              {t('purchasing.agregar-item')}
            </p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Select
                  aria-label={t('purchasing.producto')}
                  value={lineProductId}
                  onChange={(event) => {
                    const value = event.target.value
                    setLineProductId(value)
                    const product = allProducts.find((entry) => entry.id === Number(value))
                    if (product) setLineCost(String(product.cost_price))
                  }}
                  hint={products.length === 0 ? t('purchasing.hint-crea-productos') : undefined}
                >
                  <option value="">{t('purchasing.producto-opcion')}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Input
                  aria-label={t('purchasing.cantidad')}
                  type="number"
                  min="1"
                  max="999999"
                  step="1"
                  inputMode="numeric"
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  aria-label={t('purchasing.costo-unitario')}
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  inputMode="decimal"
                  value={lineCost}
                  onChange={(event) => setLineCost(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={addLine}>
                {t('purchasing.agregar-item')}
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
              {t('purchasing.sin-items-orden')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {lines.map((line) => (
                <li key={line.product_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-gray-900">
                      {productName(line.product_id)}
                    </p>
                    <p className="text-caption text-gray-500">
                      {line.quantity} × {formatCurrency(line.unit_cost)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-gray-900">
                      {formatCurrency(line.quantity * line.unit_cost)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product_id)}
                      aria-label={`${t('purchasing.quitar')} ${productName(line.product_id)}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      {t('purchasing.quitar')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">{t('purchasing.items')}</span>
              <span className="font-medium">{lines.length}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">{t('purchasing.total')}</span>
              <span className="text-h4 font-bold text-primary">{formatCurrency(lineTotal)}</span>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {t(formError)}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={detailId !== null}
        onClose={closeDetail}
        title={
          detail ? `${t('purchasing.orden')} ${detail.order_number}` : t('purchasing.detalle-orden')
        }
        size="lg"
      >
        {detailLoading ? (
          <p className="inline-flex items-center gap-2 py-6 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            {t('purchasing.cargando-detalle')}
          </p>
        ) : detailError ? (
          <ErrorState description={t(detailError)} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div>
                <p className="text-caption text-gray-500">{t('purchasing.proveedor')}</p>
                <p className="font-medium text-gray-900">{detail.supplier_name}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('purchasing.estado')}</p>
                <Badge variant={PO_STATUS[detail.status].variant}>
                  {t(PO_STATUS[detail.status].label)}
                </Badge>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('purchasing.creada')}</p>
                <p className="font-medium text-gray-900">{formatDateTime(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('purchasing.notas')}</p>
                <p className="font-medium text-gray-900">{detail.notes || '—'}</p>
              </div>
            </div>

            <DataTable
              headers={[
                t('purchasing.producto'),
                t('purchasing.cantidad'),
                t('purchasing.costo'),
                t('purchasing.subtotal'),
              ]}
            >
              {(detail.items ?? []).map((item) => (
                <TableRow key={item.id ?? item.product_id}>
                  <TableCell className="font-medium text-gray-900">
                    {item.product_name ?? productName(item.product_id)}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(item.subtotal ?? item.quantity * item.unit_cost)}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>

            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">{t('purchasing.total')}</span>
                <span className="text-h4 font-bold text-primary">
                  {formatCurrency(detail.total)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={statusOrder !== null}
        onClose={() => setStatusOrder(null)}
        title={
          statusOrder
            ? `${t('purchasing.estado-de')} ${statusOrder.order_number}`
            : t('purchasing.cambiar-estado')
        }
        footer={
          <Button variant="outline" onClick={() => setStatusOrder(null)} disabled={statusBusy}>
            {t('purchasing.cerrar')}
          </Button>
        }
      >
        {statusOrder && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('purchasing.estado-actual')}</span>
                <Badge variant={PO_STATUS[statusOrder.status].variant}>
                  {t(PO_STATUS[statusOrder.status].label)}
                </Badge>
              </div>
            </div>
            {PO_TRANSITIONS[statusOrder.status].length === 0 ? (
              <p className="text-body-sm text-gray-600">{t('purchasing.sin-transiciones')}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {PO_TRANSITIONS[statusOrder.status].map((next) => (
                  <Button
                    key={next}
                    variant={next === 'cancelled' ? 'danger' : 'primary'}
                    size="sm"
                    loading={statusBusy}
                    onClick={() => handleStatus(next)}
                  >
                    {t(PO_TRANSITION_LABELS[next])}
                  </Button>
                ))}
              </div>
            )}
            {statusOrder.status === 'pending' && (
              <p className="text-caption text-gray-500">{t('purchasing.recibir-aviso-stock')}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('purchasing.eliminar-orden')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              {t('purchasing.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              {t('purchasing.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('purchasing.eliminar-orden-prefijo')} <strong>{deleting?.order_number}</strong>?{' '}
          {t('purchasing.eliminar-orden-sufijo')}
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {t(deleteError)}
          </p>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------
   Envíos
   ------------------------------------------------------------------ */

function EnviosTab() {
  const toast = useToast()
  const version = useDataVersion()
  const { t } = useLang()
  const sales = useMemo(() => getState().sales, [version])

  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Shipment | null>(null)
  const [saleId, setSaleId] = useState('')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [statusShipment, setStatusShipment] = useState<Shipment | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  const [deleting, setDeleting] = useState<Shipment | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listShipments()
      .then((result) => {
        if (!cancelled) setShipments(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : 'purchasing.no-se-pudieron-cargar-envios',
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return shipments.filter(
      (shipment) =>
        term === '' ||
        shipment.sale_number.toLowerCase().includes(term) ||
        (shipment.tracking_code ?? '').toLowerCase().includes(term) ||
        (shipment.carrier ?? '').toLowerCase().includes(term),
    )
  }, [shipments, search])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setSaleId('')
    setCarrier('')
    setTracking('')
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (shipment: Shipment) => {
    setEditing(shipment)
    setSaleId(String(shipment.sale_id))
    setCarrier(shipment.carrier ?? '')
    setTracking(shipment.tracking_code ?? '')
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!saleId) {
      setFormError('purchasing.selecciona-venta')
      return
    }
    const carrierValue = cleanText(carrier)
    const trackingValue = cleanText(tracking)
    const carrierMaxError = maxLength(80, 'El transportista no puede superar 80 caracteres.')(
      carrierValue,
    )
    if (carrierMaxError) {
      setFormError(carrierMaxError)
      return
    }
    const trackingMaxError = maxLength(60, 'El código de seguimiento no puede superar 60 caracteres.')(
      trackingValue,
    )
    if (trackingMaxError) {
      setFormError(trackingMaxError)
      return
    }
    const trackingPatternError = pattern(
      /^[A-Za-z0-9\-]{0,60}$/,
      'El código de seguimiento sólo puede contener letras, dígitos o guiones.',
    )(trackingValue)
    if (trackingPatternError) {
      setFormError(trackingPatternError)
      return
    }
    const input = {
      sale_id: Number(saleId),
      carrier: carrierValue || null,
      tracking_code: trackingValue || null,
    }
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateShipment(editing.id, input)
        toast.success(
          t('purchasing.envio-actualizado'),
          `${t('purchasing.el-envio-de')} ${editing.sale_number} ${t('purchasing.se-guardo')}`,
        )
      } else {
        const created = await createShipment(input)
        toast.success(
          t('purchasing.envio-creado'),
          `${t('purchasing.envio-creado-desc')} ${created.sale_number}.`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-guardar-envio',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (status: ShipmentStatus) => {
    if (!statusShipment) return
    setStatusBusy(true)
    try {
      await setShipmentStatus(statusShipment.id, status)
      toast.success(
        t('purchasing.estado-actualizado'),
        `${t('purchasing.el-envio-de')} ${statusShipment.sale_number} ${t('purchasing.paso-a')} «${t(SHIPMENT_STATUS[status].label)}».`,
      )
      setStatusShipment(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('purchasing.no-se-pudo-cambiar-estado'),
        reason instanceof Error ? reason.message : t('purchasing.error-inesperado'),
      )
    } finally {
      setStatusBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    setDeleteError(null)
    try {
      await deleteShipment(deleting.id)
      toast.success(
        t('purchasing.envio-eliminado'),
        `${t('purchasing.el-envio-de')} ${deleting.sale_number} ${t('purchasing.se-elimino')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'purchasing.no-se-pudo-eliminar-envio',
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">{t('purchasing.envios')}</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('purchasing.nuevo-envio')}
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label={t('purchasing.buscar-envios')}
          placeholder={t('purchasing.buscar-envios-placeholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={t(error)}
            action={
              <Button variant="outline" onClick={reload}>
                {t('purchasing.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && shipments.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('purchasing.codigo'),
              t('purchasing.venta'),
              t('purchasing.transportista'),
              t('purchasing.tracking'),
              t('purchasing.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('purchasing.cargando-envios')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Truck}
            title={t('purchasing.sin-envios')}
            description={t('purchasing.sin-envios-desc')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('purchasing.nuevo-envio')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('purchasing.codigo'),
              t('purchasing.venta'),
              t('purchasing.transportista'),
              t('purchasing.tracking'),
              t('purchasing.estado'),
              t('purchasing.acciones'),
            ]}
          >
            {visible.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell className="font-mono text-caption">ENV-{shipment.id}</TableCell>
                <TableCell className="font-medium text-gray-900">{shipment.sale_number}</TableCell>
                <TableCell className="text-gray-600">{shipment.carrier ?? '—'}</TableCell>
                <TableCell className="font-mono text-caption">
                  {shipment.tracking_code ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={SHIPMENT_STATUS[shipment.status].variant}>
                    {t(SHIPMENT_STATUS[shipment.status].label)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton
                      label={`${t('purchasing.cambiar-estado-del-envio')} ${shipment.sale_number}`}
                      onClick={() => setStatusShipment(shipment)}
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`${t('purchasing.editar-envio-de')} ${shipment.sale_number}`}
                      onClick={() => openEdit(shipment)}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`${t('purchasing.eliminar-envio-de')} ${shipment.sale_number}`}
                      tone="danger"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(shipment)
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false)
        }}
        title={
          editing ? t('purchasing.editar-envio') : t('purchasing.nuevo-envio')
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('purchasing.cancelar')}
            </Button>
            <Button type="submit" form="shipment-form" loading={saving}>
              {editing ? t('purchasing.guardar-cambios') : t('purchasing.crear-envio')}
            </Button>
          </>
        }
      >
        <form id="shipment-form" onSubmit={handleSubmit} className="space-y-4">
          <Select
            label={t('purchasing.venta')}
            required
            value={saleId}
            onChange={(event) => setSaleId(event.target.value)}
            hint={sales.length === 0 ? t('purchasing.hint-registra-ventas') : undefined}
          >
            <option value="">{t('purchasing.selecciona-venta-opcion')}</option>
            {sales.map((sale) => (
              <option key={sale.id} value={sale.id}>
                {sale.sale_number} · {sale.customer.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('purchasing.transportista')}
              maxLength={80}
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder={t('purchasing.ej-transportista')}
              hint={t('purchasing.opcional')}
            />
            <Input
              label={t('purchasing.codigo-seguimiento')}
              maxLength={60}
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder={t('purchasing.ej-tracking')}
              hint={t('purchasing.hint-tracking')}
            />
          </div>
          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {t(formError)}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={statusShipment !== null}
        onClose={() => setStatusShipment(null)}
        title={t('purchasing.cambiar-estado-del-envio')}
        footer={
          <Button variant="outline" onClick={() => setStatusShipment(null)} disabled={statusBusy}>
            {t('purchasing.cerrar')}
          </Button>
        }
      >
        {statusShipment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {t('purchasing.envio-de')} {statusShipment.sale_number}
                </span>
                <Badge variant={SHIPMENT_STATUS[statusShipment.status].variant}>
                  {t(SHIPMENT_STATUS[statusShipment.status].label)}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(SHIPMENT_STATUS) as ShipmentStatus[])
                .filter((status) => status !== statusShipment.status)
                .map((status) => (
                  <Button
                    key={status}
                    variant={status === 'cancelled' ? 'danger' : 'primary'}
                    size="sm"
                    loading={statusBusy}
                    onClick={() => handleStatus(status)}
                  >
                    {t(SHIPMENT_STATUS[status].label)}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('purchasing.eliminar-envio')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              {t('purchasing.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              {t('purchasing.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('purchasing.eliminar-envio-prefijo')} <strong>{deleting?.sale_number}</strong>?{' '}
          {t('purchasing.eliminar-envio-sufijo')}
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {t(deleteError)}
          </p>
        )}
      </Modal>
    </div>
  )
}
