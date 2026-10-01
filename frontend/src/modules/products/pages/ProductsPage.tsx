import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import Table, { TableRow, TableCell, TableStateRow } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/utils/formatters'
import {
  PRODUCT_CATEGORIES,
  createProduct,
  listProducts,
  toggleProductStatus,
  updateProduct,
} from '../services/productService'
import type { Product, ProductInput } from '@/types/product'
import ProductForm from '../components/ProductForm'

/**
 * Página de Productos (Fase 07 · RF-04): catálogo con búsqueda, filtros
 * por categoría/estado/stock bajo, alta/edición y activación.
 * TODO(Fase 05): conectar con /api/v1/products.
 */

const PAGE_SIZE = 10

/** Estado del stock según nivel (txt §5.5: warning = stock bajo, error = sin stock). */
function stockBadge(product: Product): { variant: 'error' | 'warning' | 'success'; label: string } | null {
  if (product.current_stock === 0) return { variant: 'error', label: 'Sin stock' }
  if (product.current_stock <= product.min_stock) return { variant: 'warning', label: 'Stock bajo' }
  return null
}

export default function ProductsPage() {
  const toast = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('')
  const [lowStock, setLowStock] = useState(false)
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryId, status, lowStock])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listProducts({ search: debouncedSearch, category_id: categoryId, status, low_stock: lowStock })
      .then((result) => {
        if (!cancelled) setProducts(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los productos')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, categoryId, status, lowStock, attempt])

  const pageCount = Math.max(Math.ceil(products.length / PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const visible = useMemo(
    () => products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [products, currentPage],
  )

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setFormOpen(true)
  }

  const handleSubmit = async (input: ProductInput) => {
    try {
      if (editing) {
        await updateProduct(editing.id, input)
        toast.success('Producto actualizado', `${input.name} se guardó correctamente.`)
      } else {
        await createProduct(input)
        toast.success('Producto creado', `${input.name} se agregó al catálogo.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error('No se pudo guardar', reason instanceof Error ? reason.message : 'Error inesperado')
    }
  }

  const handleToggle = async (product: Product) => {
    try {
      const updated = await toggleProductStatus(product.id)
      toast.success(
        updated.status === 'active' ? 'Producto activado' : 'Producto desactivado',
        `${product.name} ahora está ${updated.status === 'active' ? 'activo' : 'inactivo'}.`,
      )
      reload()
    } catch (reason: unknown) {
      toast.error('No se pudo cambiar el estado', reason instanceof Error ? reason.message : 'Error inesperado')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Productos</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Catálogo de productos: precios, stock, categorías y estados (RF-04).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="card flex flex-col gap-3 lg:flex-row lg:items-end">
        <Input
          type="search"
          aria-label="Buscar productos"
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="lg:flex-1"
        />
        <Select
          aria-label="Filtrar por categoría"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : '')}
          className="lg:w-48"
        >
          <option value="">Todas las categorías</option>
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive' | '')}
          className="lg:w-40"
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
        <Checkbox
          label="Solo stock bajo"
          checked={lowStock}
          onChange={(event) => setLowStock(event.target.checked)}
        />
      </div>

      {/* Contenido */}
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
      ) : loading && products.length === 0 ? (
        <div className="card">
          <Table headers={['Producto', 'Categoría', 'Precio', 'Stock', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando productos…
              </span>
            </TableStateRow>
          </Table>
        </div>
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Sin productos"
            description="No hay registros que coincidan con la búsqueda."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo producto
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Table headers={['Producto', 'Categoría', 'Precio', 'Stock', 'Estado', 'Acciones']}>
            {visible.map((product) => {
              const stock = stockBadge(product)
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="font-mono text-caption text-gray-500">{product.sku}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">{product.category.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(product.sale_price)}</div>
                    <div className="text-caption text-gray-500">
                      costo {formatCurrency(product.cost_price)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {product.current_stock} {product.unit}
                    </div>
                    <div className="text-caption text-gray-500">mín. {product.min_stock}</div>
                    {stock && (
                      <div className="mt-1">
                        <Badge variant={stock.variant}>{stock.label}</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>
                      {product.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        aria-label={`Editar ${product.name}`}
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(product)}
                        aria-label={
                          product.status === 'active'
                            ? `Desactivar ${product.name}`
                            : `Activar ${product.name}`
                        }
                        title={product.status === 'active' ? 'Desactivar' : 'Activar'}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Power aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </Table>

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            total={products.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
