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
import { getState } from '@/data/store'
import { formatCurrency, formatDateTime } from '@/utils/formatters'
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
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'ordenes', label: 'Órdenes de compra' },
  { id: 'envios', label: 'Envíos' },
]

const PO_STATUS: Record<PurchaseOrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  approved: { label: 'Aprobada', variant: 'info' },
  received: { label: 'Recibida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'error' },
}

const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

const PO_TRANSITION_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobar',
  received: 'Marcar recibida',
  cancelled: 'Cancelar',
}

const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  shipped: { label: 'Enviado', variant: 'info' },
  delivered: { label: 'Entregado', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'error' },
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

  return (
    <div className="space-y-6">
      <div>
        <h1>Compras</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Proveedores, órdenes de compra y envíos del flujo de adquisiciones.
        </p>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="compras" />

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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los proveedores')
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
    const name = form.name.trim()
    if (!/^\d{8,15}$/.test(ruc)) {
      setFormError('El RUC debe tener entre 8 y 15 dígitos.')
      return
    }
    if (name.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const input = {
      ruc,
      name,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSupplier(editing.id, input)
        toast.success('Proveedor actualizado', `${name} se guardó correctamente.`)
      } else {
        await createSupplier(input)
        toast.success('Proveedor creado', `${name} ya está disponible en Órdenes de compra.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el proveedor.')
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
      toast.success('Proveedor eliminado', `${deleting.name} se quitó del directorio.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el proveedor.')
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Proveedores</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label="Buscar proveedores"
          placeholder="Buscar por nombre o RUC…"
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
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && suppliers.length === 0 ? (
        <div className="card">
          <DataTable headers={['Proveedor', 'RUC', 'Contacto', 'Estado', '']}>
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando proveedores…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Sin proveedores"
            description="Aún no hay proveedores registrados. Crea el primero para poder levantar órdenes de compra."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo proveedor
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Proveedor', 'RUC', 'Contacto', 'Estado', 'Acciones']}>
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
                    {supplier.status === 'inactive' ? 'Inactivo' : 'Activo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton label={`Editar ${supplier.name}`} onClick={() => openEdit(supplier)}>
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`Eliminar ${supplier.name}`}
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
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear proveedor'}
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
              placeholder="Ej. 20123456789"
              autoFocus
            />
            <Input
              label="Nombre"
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Distribuidora Andina"
            />
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="ventas@proveedor.com"
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="Ej. 999 888 777"
            />
          </div>
          <Textarea
            label="Dirección"
            hint="Opcional."
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder="Ej. Av. Industrial 123, Lima"
          />
          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar proveedor"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar el proveedor <strong>{deleting?.name}</strong> (RUC {deleting?.ruc})? Se dará de
          baja y ya no podrá usarse en nuevas órdenes de compra.
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

/* ------------------------------------------------------------------
   Órdenes de compra
   ------------------------------------------------------------------ */

function OrdenesTab() {
  const toast = useToast()
  const version = useDataVersion()
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
            reason instanceof Error ? reason.message : 'No se pudieron cargar las órdenes de compra',
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
    allProducts.find((product) => product.id === productId)?.name ?? `Producto #${productId}`

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
        'No se pudo cargar la orden',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    }
  }

  const addLine = () => {
    const product = products.find((entry) => entry.id === Number(lineProductId))
    if (!product) {
      setFormError('Selecciona un producto para agregar el ítem.')
      return
    }
    if (lines.some((line) => line.product_id === product.id)) {
      setFormError('Ese producto ya está en la orden.')
      return
    }
    const quantity = Math.max(Number(lineQuantity) || 0, 1)
    const unitCost = Number(lineCost)
    if (Number.isNaN(unitCost) || unitCost < 0) {
      setFormError('Ingresa un costo unitario válido.')
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
      setFormError('Selecciona un proveedor.')
      return
    }
    if (lines.length === 0) {
      setFormError('Agrega al menos un ítem a la orden.')
      return
    }
    setFormError(null)
    setSaving(true)
    const input = {
      supplier_id: Number(supplierId),
      notes: notes.trim() || null,
      items: lines.map((line) => ({ ...line })),
    }
    try {
      if (editing) {
        await updatePurchaseOrder(editing.id, input)
        toast.success('Orden actualizada', `${editing.order_number} se guardó correctamente.`)
      } else {
        const created = await createPurchaseOrder(input)
        toast.success(
          'Orden creada',
          `${created.order_number} registrada por ${formatCurrency(created.total)}.`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la orden.')
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
          reason instanceof Error ? reason.message : 'No se pudo cargar el detalle de la orden.',
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
        status === 'received' ? 'Orden recibida' : 'Estado actualizado',
        status === 'received'
          ? 'El stock de los productos fue actualizado en el inventario.'
          : `${statusOrder.order_number} pasó a «${PO_STATUS[status].label}».`,
      )
      setStatusOrder(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo cambiar el estado',
        reason instanceof Error ? reason.message : 'Error inesperado',
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
      toast.success('Orden eliminada', `${deleting.order_number} se eliminó del listado.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'No se pudo eliminar la orden.',
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
          <h2 className="text-h3 text-gray-800">Órdenes de compra</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva orden
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label="Buscar órdenes de compra"
          placeholder="Buscar por número de orden o proveedor…"
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
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="card">
          <DataTable headers={['Orden', 'Proveedor', 'Ítems', 'Total', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando órdenes de compra…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title="Sin órdenes de compra"
            description="Aún no hay órdenes registradas. Crea la primera para solicitar productos a un proveedor."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva orden
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Orden', 'Proveedor', 'Ítems', 'Total', 'Estado', 'Acciones']}>
            {visible.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-caption">{order.order_number}</TableCell>
                <TableCell className="font-medium text-gray-900">{order.supplier_name}</TableCell>
                <TableCell>{order.item_count}</TableCell>
                <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                <TableCell>
                  <Badge variant={PO_STATUS[order.status].variant}>
                    {PO_STATUS[order.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton label={`Ver detalle de ${order.order_number}`} onClick={() => openDetail(order)}>
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`Cambiar estado de ${order.order_number}`}
                      onClick={() => setStatusOrder(order)}
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    {order.status === 'pending' && (
                      <>
                        <RowButton
                          label={`Editar ${order.order_number}`}
                          onClick={() => openEdit(order)}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </RowButton>
                        <RowButton
                          label={`Eliminar ${order.order_number}`}
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
        title={editing ? `Editar ${editing.order_number}` : 'Nueva orden de compra'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="order-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear orden'}
            </Button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Proveedor"
              required
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              hint={suppliers.length === 0 ? 'Crea proveedores en la pestaña «Proveedores».' : undefined}
            >
              <option value="">Selecciona un proveedor…</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · RUC {supplier.ruc}
                </option>
              ))}
            </Select>
            <Textarea
              label="Notas"
              hint="Opcional. Indicaciones para el proveedor."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej. Entrega en almacén central"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-body-sm font-semibold text-gray-700">Agregar ítem</p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Select
                  aria-label="Producto"
                  value={lineProductId}
                  onChange={(event) => {
                    const value = event.target.value
                    setLineProductId(value)
                    const product = allProducts.find((entry) => entry.id === Number(value))
                    if (product) setLineCost(String(product.cost_price))
                  }}
                  hint={products.length === 0 ? 'Crea productos en el menú Productos.' : undefined}
                >
                  <option value="">Producto…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Input
                  aria-label="Cantidad"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  aria-label="Costo unitario"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={lineCost}
                  onChange={(event) => setLineCost(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={addLine}>
                Agregar ítem
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
              Aún no agregaste ítems a la orden.
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
                      aria-label={`Quitar ${productName(line.product_id)}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Ítems</span>
              <span className="font-medium">{lines.length}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-h4 font-bold text-primary">{formatCurrency(lineTotal)}</span>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={detailId !== null}
        onClose={closeDetail}
        title={detail ? `Orden ${detail.order_number}` : 'Detalle de la orden'}
        size="lg"
      >
        {detailLoading ? (
          <p className="inline-flex items-center gap-2 py-6 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            Cargando detalle…
          </p>
        ) : detailError ? (
          <ErrorState description={detailError} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div>
                <p className="text-caption text-gray-500">Proveedor</p>
                <p className="font-medium text-gray-900">{detail.supplier_name}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">Estado</p>
                <Badge variant={PO_STATUS[detail.status].variant}>
                  {PO_STATUS[detail.status].label}
                </Badge>
              </div>
              <div>
                <p className="text-caption text-gray-500">Creada</p>
                <p className="font-medium text-gray-900">{formatDateTime(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">Notas</p>
                <p className="font-medium text-gray-900">{detail.notes || '—'}</p>
              </div>
            </div>

            <DataTable headers={['Producto', 'Cantidad', 'Costo', 'Subtotal']}>
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
                <span className="font-semibold text-gray-900">Total</span>
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
        title={statusOrder ? `Estado de ${statusOrder.order_number}` : 'Cambiar estado'}
        footer={
          <Button variant="outline" onClick={() => setStatusOrder(null)} disabled={statusBusy}>
            Cerrar
          </Button>
        }
      >
        {statusOrder && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado actual</span>
                <Badge variant={PO_STATUS[statusOrder.status].variant}>
                  {PO_STATUS[statusOrder.status].label}
                </Badge>
              </div>
            </div>
            {PO_TRANSITIONS[statusOrder.status].length === 0 ? (
              <p className="text-body-sm text-gray-600">
                Esta orden ya no tiene transiciones disponibles.
              </p>
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
                    {PO_TRANSITION_LABELS[next]}
                  </Button>
                ))}
              </div>
            )}
            {statusOrder.status === 'pending' && (
              <p className="text-caption text-gray-500">
                Al recibir la orden se actualiza el stock de cada producto.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar orden de compra"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar la orden <strong>{deleting?.order_number}</strong>? Solo se pueden eliminar las
          órdenes pendientes.
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

/* ------------------------------------------------------------------
   Envíos
   ------------------------------------------------------------------ */

function EnviosTab() {
  const toast = useToast()
  const version = useDataVersion()
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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los envíos')
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
      setFormError('Selecciona una venta.')
      return
    }
    const input = {
      sale_id: Number(saleId),
      carrier: carrier.trim() || null,
      tracking_code: tracking.trim() || null,
    }
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateShipment(editing.id, input)
        toast.success('Envío actualizado', `El envío de ${editing.sale_number} se guardó.`)
      } else {
        const created = await createShipment(input)
        toast.success('Envío creado', `Se registró el envío de la venta ${created.sale_number}.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el envío.')
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
        'Estado actualizado',
        `El envío de ${statusShipment.sale_number} pasó a «${SHIPMENT_STATUS[status].label}».`,
      )
      setStatusShipment(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo cambiar el estado',
        reason instanceof Error ? reason.message : 'Error inesperado',
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
      toast.success('Envío eliminado', `El envío de ${deleting.sale_number} se eliminó.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el envío.')
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Envíos</h2>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo envío
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label="Buscar envíos"
          placeholder="Buscar por venta, transportista o tracking…"
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
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && shipments.length === 0 ? (
        <div className="card">
          <DataTable headers={['Código', 'Venta', 'Transportista', 'Tracking', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando envíos…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Truck}
            title="Sin envíos"
            description="Aún no hay envíos registrados. Crea el primero para despachar una venta."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo envío
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Código', 'Venta', 'Transportista', 'Tracking', 'Estado', 'Acciones']}>
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
                    {SHIPMENT_STATUS[shipment.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton
                      label={`Cambiar estado del envío ${shipment.sale_number}`}
                      onClick={() => setStatusShipment(shipment)}
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`Editar envío de ${shipment.sale_number}`}
                      onClick={() => openEdit(shipment)}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    <RowButton
                      label={`Eliminar envío de ${shipment.sale_number}`}
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
        title={editing ? 'Editar envío' : 'Nuevo envío'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="shipment-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear envío'}
            </Button>
          </>
        }
      >
        <form id="shipment-form" onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Venta"
            required
            value={saleId}
            onChange={(event) => setSaleId(event.target.value)}
            hint={sales.length === 0 ? 'Registra ventas en el menú Ventas.' : undefined}
          >
            <option value="">Selecciona una venta…</option>
            {sales.map((sale) => (
              <option key={sale.id} value={sale.id}>
                {sale.sale_number} · {sale.customer.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Transportista"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="Ej. Shalom"
              hint="Opcional."
            />
            <Input
              label="Código de seguimiento"
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="Ej. TRK-998877"
              hint="Opcional. Debe ser único."
            />
          </div>
          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={statusShipment !== null}
        onClose={() => setStatusShipment(null)}
        title="Cambiar estado del envío"
        footer={
          <Button variant="outline" onClick={() => setStatusShipment(null)} disabled={statusBusy}>
            Cerrar
          </Button>
        }
      >
        {statusShipment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Envío de {statusShipment.sale_number}</span>
                <Badge variant={SHIPMENT_STATUS[statusShipment.status].variant}>
                  {SHIPMENT_STATUS[statusShipment.status].label}
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
                    {SHIPMENT_STATUS[status].label}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar envío"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar el envío de la venta <strong>{deleting?.sale_number}</strong>? Esta acción no se
          puede deshacer.
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
