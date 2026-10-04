import { useEffect, useState } from 'react'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { getState } from '@/data/store'
import {
  createWarehouse,
  createWarehouseStock,
  deleteWarehouse,
  deleteWarehouseStock,
  listWarehouseStock,
  listWarehouses,
  updateWarehouse,
  updateWarehouseStock,
} from '../services/warehouseService'
import type { Warehouse, WarehouseInput, WarehouseStockRow } from '../services/warehouseService'

/** Pestaña «Almacenes» de Inventario: CRUD de almacenes + su stock por producto. */

const EMPTY_FORM: WarehouseInput = { code: '', name: '', address: '' }

const EMPTY_STOCK_FORM = { product_id: '', stock: '0', min_stock: '0' }

export default function WarehousesPanel() {
  const { t } = useLang()
  const toast = useToast()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [form, setForm] = useState<WarehouseInput>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Warehouse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [stockWarehouse, setStockWarehouse] = useState<Warehouse | null>(null)
  const [stockRows, setStockRows] = useState<WarehouseStockRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM)
  const [stockEditingId, setStockEditingId] = useState<number | null>(null)
  const [stockSaving, setStockSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listWarehouses()
      .then((result) => {
        if (!cancelled) setWarehouses(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t('inventory.no-se-pudieron-cargar-los-almacenes'),
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

  const openEdit = (warehouse: Warehouse) => {
    setEditing(warehouse)
    setForm({ code: warehouse.code, name: warehouse.name, address: warehouse.address ?? '' })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const code = form.code.trim()
    const name = form.name.trim()
    if (code.length < 1) {
      setFormError(t('inventory.el-codigo-es-obligatorio'))
      return
    }
    if (name.length < 2) {
      setFormError(t('inventory.el-nombre-debe-tener-al-menos-2-caracteres'))
      return
    }
    const input: WarehouseInput = { code, name, address: form.address?.trim() || null }
    setSaving(true)
    try {
      if (editing) {
        await updateWarehouse(editing.id, input)
        toast.success(t('inventory.almacen-actualizado'), `${name} ${t('inventory.guardado-correctamente')}`)
      } else {
        await createWarehouse(input)
        toast.success(t('inventory.almacen-creado'), `${name} ${t('inventory.ya-esta-disponible')}`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-guardar-el-almacen'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteWarehouse(deleting.id)
      toast.success(t('inventory.almacen-eliminado'), `${deleting.name} ${t('inventory.se-quito-del-inventario')}`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-eliminar-el-almacen'),
      )
    }
  }

  const closeStock = () => {
    setStockWarehouse(null)
    setStockRows([])
    setStockError(null)
    setStockForm(EMPTY_STOCK_FORM)
    setStockEditingId(null)
  }

  const openStock = async (warehouse: Warehouse) => {
    setStockWarehouse(warehouse)
    setStockRows([])
    setStockError(null)
    setStockLoading(true)
    setStockForm(EMPTY_STOCK_FORM)
    setStockEditingId(null)
    try {
      setStockRows(await listWarehouseStock(warehouse.id))
    } catch (reason: unknown) {
      setStockError(
        reason instanceof Error
          ? reason.message
          : t('inventory.no-se-pudo-cargar-el-stock-del-almacen'),
      )
    } finally {
      setStockLoading(false)
    }
  }

  const reloadStock = async (warehouseId: number) => {
    try {
      setStockRows(await listWarehouseStock(warehouseId))
    } catch {
      setStockError(t('inventory.no-se-pudo-actualizar-el-stock-del-almacen'))
    }
  }

  const handleStockSubmit = async () => {
    if (!stockWarehouse) return
    const productId = Number(stockForm.product_id)
    const stock = Number(stockForm.stock)
    const minStock = Number(stockForm.min_stock)
    if (stockEditingId === null && !productId) {
      setStockError(t('inventory.selecciona-el-producto'))
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      setStockError(t('inventory.el-stock-debe-ser-un-numero-mayor-o-igual-a-0'))
      return
    }
    if (Number.isNaN(minStock) || minStock < 0) {
      setStockError(t('inventory.el-stock-minimo-debe-ser-un-numero-mayor-o-igual-a-0'))
      return
    }
    setStockSaving(true)
    try {
      if (stockEditingId !== null) {
        await updateWarehouseStock(stockEditingId, { stock, min_stock: minStock })
        toast.success(t('inventory.stock-actualizado'), t('inventory.se-guardaron-las-cantidades-del-producto'))
      } else {
        await createWarehouseStock({
          warehouse_id: stockWarehouse.id,
          product_id: productId,
          stock,
          min_stock: minStock,
        })
        toast.success(t('inventory.producto-agregado'), t('inventory.ya-tiene-stock-asignado-en-este-almacen'))
      }
      setStockForm(EMPTY_STOCK_FORM)
      setStockEditingId(null)
      setStockError(null)
      await reloadStock(stockWarehouse.id)
      reload()
    } catch (reason: unknown) {
      setStockError(
        reason instanceof Error
          ? reason.message
          : t('inventory.no-se-pudo-guardar-el-stock-del-producto'),
      )
    } finally {
      setStockSaving(false)
    }
  }

  const handleStockDelete = async (row: WarehouseStockRow) => {
    if (!stockWarehouse) return
    try {
      await deleteWarehouseStock(row.id)
      toast.success(t('inventory.producto-quitado'), `${row.product_name} ${t('inventory.salio-del-almacen')}`)
      if (stockEditingId === row.id) {
        setStockEditingId(null)
        setStockForm(EMPTY_STOCK_FORM)
      }
      await reloadStock(stockWarehouse.id)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('inventory.no-se-pudo-quitar'),
        reason instanceof Error ? reason.message : t('inventory.error-inesperado'),
      )
    }
  }

  const products = getState().products

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('inventory.almacenes-de-la-empresa-y-el-stock-de-cada-producto-dentro-de-ellos')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('inventory.nuevo-almacen')}
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
      ) : loading && warehouses.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('inventory.codigo'),
              t('inventory.nombre'),
              t('inventory.direccion'),
              t('inventory.lineas-stock'),
              '',
            ]}
          >
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('inventory.cargando-almacenes')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Boxes}
            title={t('inventory.sin-almacenes')}
            description={t(
              'inventory.crea-un-almacen-para-poder-asignar-stock-por-producto-y-hacer-conteos',
            )}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('inventory.nuevo-almacen')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('inventory.codigo'),
              t('inventory.nombre'),
              t('inventory.direccion'),
              t('inventory.lineas-stock'),
              t('inventory.acciones'),
            ]}
          >
            {warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="font-mono font-medium text-gray-900">
                  {warehouse.code}
                </TableCell>
                <TableCell className="font-medium text-gray-900">{warehouse.name}</TableCell>
                <TableCell className="text-gray-600">{warehouse.address ?? '—'}</TableCell>
                <TableCell>
                  {warehouse.stock_lines}
                  <span className="text-caption text-gray-500">
                    {' · '}
                    {warehouse.total_units} {t('inventory.und')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openStock(warehouse)}
                      aria-label={`${t('inventory.ver-stock-de')} ${warehouse.name}`}
                      title={t('inventory.stock')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Boxes aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(warehouse)}
                      aria-label={`${t('inventory.editar')} ${warehouse.name}`}
                      title={t('inventory.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(warehouse)
                      }}
                      aria-label={`${t('inventory.eliminar')} ${warehouse.name}`}
                      title={t('inventory.eliminar')}
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

      {/* Crear / editar almacén */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('inventory.editar-almacen') : t('inventory.nuevo-almacen')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('inventory.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('inventory.guardar-cambios') : t('inventory.crear-almacen')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('inventory.codigo')}
              required
              maxLength={20}
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder={t('inventory.ej-alm-01')}
              error={formError ?? undefined}
              autoFocus
            />
            <Input
              label={t('inventory.nombre')}
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={t('inventory.ej-almacen-central')}
            />
          </div>
          <Input
            label={t('inventory.direccion')}
            value={form.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder={t('inventory.ej-av-principal-123')}
            hint={t('inventory.opcional')}
          />
        </div>
      </Modal>

      {/* Stock por almacén */}
      <Modal
        open={stockWarehouse !== null}
        onClose={closeStock}
        title={`${t('inventory.stock')} · ${stockWarehouse?.name ?? ''}`}
        size="lg"
        footer={
          <Button variant="outline" onClick={closeStock}>
            {t('inventory.cerrar')}
          </Button>
        }
      >
        <div className="space-y-4">
          {stockLoading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-body-sm text-gray-500">
              <Spinner size={16} className="text-loading" />
              {t('inventory.cargando-stock')}
            </p>
          ) : stockError && stockRows.length === 0 ? (
            <p className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {stockError}
            </p>
          ) : stockRows.length === 0 ? (
            <EmptyState
              title={t('inventory.sin-productos-en-este-almacen')}
              description={t('inventory.agrega-el-primer-producto-con-su-stock-y-su-stock-minimo')}
            />
          ) : (
            <DataTable
              headers={[
                t('inventory.producto'),
                t('inventory.stock'),
                t('inventory.stock-minimo'),
                t('inventory.acciones'),
              ]}
            >
              {stockRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-gray-900">{row.product_name}</TableCell>
                  <TableCell>{row.stock}</TableCell>
                  <TableCell className="text-gray-600">{row.min_stock}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStockEditingId(row.id)
                          setStockForm({
                            product_id: String(row.product_id),
                            stock: String(row.stock),
                            min_stock: String(row.min_stock),
                          })
                          setStockError(null)
                        }}
                        aria-label={`${t('inventory.editar')} ${row.product_name}`}
                        title={t('inventory.editar')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStockDelete(row)}
                        aria-label={`${t('inventory.quitar')} ${row.product_name}`}
                        title={t('inventory.quitar')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-2 text-body-sm font-medium text-gray-700">
              {stockEditingId !== null
                ? t('inventory.editar-producto-del-almacen')
                : t('inventory.agregar-producto')}
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end">
              <Select
                label={t('inventory.producto')}
                value={stockForm.product_id}
                onChange={(event) => setStockForm({ ...stockForm, product_id: event.target.value })}
                disabled={stockEditingId !== null}
              >
                <option value="">{t('inventory.selecciona-un-producto-2')}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
              <Input
                label={t('inventory.stock')}
                type="number"
                min={0}
                step={1}
                value={stockForm.stock}
                onChange={(event) => setStockForm({ ...stockForm, stock: event.target.value })}
              />
              <Input
                label={t('inventory.minimo')}
                type="number"
                min={0}
                step={1}
                value={stockForm.min_stock}
                onChange={(event) => setStockForm({ ...stockForm, min_stock: event.target.value })}
              />
              <div className="flex gap-2">
                {stockEditingId !== null && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStockEditingId(null)
                      setStockForm(EMPTY_STOCK_FORM)
                      setStockError(null)
                    }}
                  >
                    {t('inventory.cancelar')}
                  </Button>
                )}
                <Button onClick={handleStockSubmit} loading={stockSaving}>
                  {stockEditingId !== null ? t('inventory.guardar') : t('inventory.agregar')}
                </Button>
              </div>
            </div>
            {stockError && (
              <p role="alert" className="mt-2 text-caption text-error">
                {stockError}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Eliminar almacén */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('inventory.eliminar-almacen')}
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
          {t('inventory.eliminar-el-almacen')} <strong>{deleting?.name}</strong>?{' '}
          {t('inventory.no-es-posible-si-tiene-stock-asignado')}
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
