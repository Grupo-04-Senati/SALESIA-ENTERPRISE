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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los almacenes')
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
      setFormError('El código es obligatorio.')
      return
    }
    if (name.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const input: WarehouseInput = { code, name, address: form.address?.trim() || null }
    setSaving(true)
    try {
      if (editing) {
        await updateWarehouse(editing.id, input)
        toast.success('Almacén actualizado', `${name} se guardó correctamente.`)
      } else {
        await createWarehouse(input)
        toast.success('Almacén creado', `${name} ya está disponible.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el almacén.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteWarehouse(deleting.id)
      toast.success('Almacén eliminado', `${deleting.name} se quitó del inventario.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el almacén.')
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
        reason instanceof Error ? reason.message : 'No se pudo cargar el stock del almacén.',
      )
    } finally {
      setStockLoading(false)
    }
  }

  const reloadStock = async (warehouseId: number) => {
    try {
      setStockRows(await listWarehouseStock(warehouseId))
    } catch {
      setStockError('No se pudo actualizar el stock del almacén.')
    }
  }

  const handleStockSubmit = async () => {
    if (!stockWarehouse) return
    const productId = Number(stockForm.product_id)
    const stock = Number(stockForm.stock)
    const minStock = Number(stockForm.min_stock)
    if (stockEditingId === null && !productId) {
      setStockError('Selecciona el producto.')
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      setStockError('El stock debe ser un número mayor o igual a 0.')
      return
    }
    if (Number.isNaN(minStock) || minStock < 0) {
      setStockError('El stock mínimo debe ser un número mayor o igual a 0.')
      return
    }
    setStockSaving(true)
    try {
      if (stockEditingId !== null) {
        await updateWarehouseStock(stockEditingId, { stock, min_stock: minStock })
        toast.success('Stock actualizado', 'Se guardaron las cantidades del producto.')
      } else {
        await createWarehouseStock({
          warehouse_id: stockWarehouse.id,
          product_id: productId,
          stock,
          min_stock: minStock,
        })
        toast.success('Producto agregado', 'Ya tiene stock asignado en este almacén.')
      }
      setStockForm(EMPTY_STOCK_FORM)
      setStockEditingId(null)
      setStockError(null)
      await reloadStock(stockWarehouse.id)
      reload()
    } catch (reason: unknown) {
      setStockError(
        reason instanceof Error ? reason.message : 'No se pudo guardar el stock del producto.',
      )
    } finally {
      setStockSaving(false)
    }
  }

  const handleStockDelete = async (row: WarehouseStockRow) => {
    if (!stockWarehouse) return
    try {
      await deleteWarehouseStock(row.id)
      toast.success('Producto quitado', `${row.product_name} salió del almacén.`)
      if (stockEditingId === row.id) {
        setStockEditingId(null)
        setStockForm(EMPTY_STOCK_FORM)
      }
      await reloadStock(stockWarehouse.id)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo quitar',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    }
  }

  const products = getState().products

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Almacenes de la empresa y el stock de cada producto dentro de ellos.
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo almacén
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
      ) : loading && warehouses.length === 0 ? (
        <div className="card">
          <DataTable headers={['Código', 'Nombre', 'Dirección', 'Líneas stock', '']}>
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando almacenes…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Boxes}
            title="Sin almacenes"
            description="Crea un almacén para poder asignar stock por producto y hacer conteos."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo almacén
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Código', 'Nombre', 'Dirección', 'Líneas stock', 'Acciones']}>
            {warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="font-mono font-medium text-gray-900">
                  {warehouse.code}
                </TableCell>
                <TableCell className="font-medium text-gray-900">{warehouse.name}</TableCell>
                <TableCell className="text-gray-600">{warehouse.address ?? '—'}</TableCell>
                <TableCell>
                  {warehouse.stock_lines}
                  <span className="text-caption text-gray-500"> · {warehouse.total_units} und.</span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openStock(warehouse)}
                      aria-label={`Ver stock de ${warehouse.name}`}
                      title="Stock"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Boxes aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(warehouse)}
                      aria-label={`Editar ${warehouse.name}`}
                      title="Editar"
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
                      aria-label={`Eliminar ${warehouse.name}`}
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

      {/* Crear / editar almacén */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar almacén' : 'Nuevo almacén'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear almacén'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Código"
              required
              maxLength={20}
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="Ej. ALM-01"
              error={formError ?? undefined}
              autoFocus
            />
            <Input
              label="Nombre"
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Almacén central"
            />
          </div>
          <Input
            label="Dirección"
            value={form.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder="Ej. Av. Principal 123"
            hint="Opcional"
          />
        </div>
      </Modal>

      {/* Stock por almacén */}
      <Modal
        open={stockWarehouse !== null}
        onClose={closeStock}
        title={`Stock · ${stockWarehouse?.name ?? ''}`}
        size="lg"
        footer={
          <Button variant="outline" onClick={closeStock}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-4">
          {stockLoading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-body-sm text-gray-500">
              <Spinner size={16} className="text-loading" />
              Cargando stock…
            </p>
          ) : stockError && stockRows.length === 0 ? (
            <p className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {stockError}
            </p>
          ) : stockRows.length === 0 ? (
            <EmptyState
              title="Sin productos en este almacén"
              description="Agrega el primer producto con su stock y su stock mínimo."
            />
          ) : (
            <DataTable headers={['Producto', 'Stock', 'Stock mínimo', 'Acciones']}>
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
                        aria-label={`Editar ${row.product_name}`}
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStockDelete(row)}
                        aria-label={`Quitar ${row.product_name}`}
                        title="Quitar"
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
              {stockEditingId !== null ? 'Editar producto del almacén' : 'Agregar producto'}
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end">
              <Select
                label="Producto"
                value={stockForm.product_id}
                onChange={(event) => setStockForm({ ...stockForm, product_id: event.target.value })}
                disabled={stockEditingId !== null}
              >
                <option value="">Selecciona un producto…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Stock"
                type="number"
                min={0}
                step={1}
                value={stockForm.stock}
                onChange={(event) => setStockForm({ ...stockForm, stock: event.target.value })}
              />
              <Input
                label="Mínimo"
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
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleStockSubmit} loading={stockSaving}>
                  {stockEditingId !== null ? 'Guardar' : 'Agregar'}
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
        title="Eliminar almacén"
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
          ¿Eliminar el almacén <strong>{deleting?.name}</strong>? No es posible si tiene stock
          asignado.
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
