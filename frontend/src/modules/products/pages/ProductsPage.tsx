import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Pagination from '@/components/tables/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/utils/formatters'
import {
  createProduct,
  getProductCategories,
  listProducts,
  toggleProductStatus,
  updateProduct,
} from '../services/productService'
import type { Product, ProductInput } from '@/types/product'
import ProductForm from '../components/ProductForm'
import { isLowStock } from '@/data/store'
import { useDataVersion } from '@/data/DataProvider'
import { useLang } from '@/i18n/i18n'

/**
 * Página de Productos (Fase 07 · RF-04): catálogo con búsqueda, filtros
 * por categoría/estado/stock bajo, alta/edición y activación.
 * TODO(Fase 05): conectar con /api/v1/products.
 */

const PAGE_SIZE = 10

/** Estado del stock según el umbral de alerta configurado (Automatizaciones). */
function stockBadge(product: Product): { variant: 'error' | 'warning' | 'success'; label: string } | null {
  if (product.current_stock === 0) return { variant: 'error', label: 'products.sin-stock' }
  if (isLowStock(product)) return { variant: 'warning', label: 'products.stock-bajo' }
  return null
}

export default function ProductsPage() {
  const toast = useToast()
  const { t } = useLang()

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
  const version = useDataVersion()

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
          setError(
            reason instanceof Error ? reason.message : t('products.no-se-pudieron-cargar-los-productos'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, categoryId, status, lowStock, attempt, version])

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
        toast.success(
          t('products.producto-actualizado'),
          `${input.name} ${t('products.se-guardo-correctamente')}`,
        )
      } else {
        await createProduct(input)
        toast.success(t('products.producto-creado'), `${input.name} ${t('products.se-agrego-al-catalogo')}`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('products.no-se-pudo-guardar'),
        reason instanceof Error ? reason.message : t('products.error-inesperado'),
      )
    }
  }

  const handleToggle = async (product: Product) => {
    try {
      const updated = await toggleProductStatus(product.id)
      toast.success(
        updated.status === 'active' ? t('products.producto-activado') : t('products.producto-desactivado'),
        `${product.name} ${
          updated.status === 'active' ? t('products.ahora-esta-activo') : t('products.ahora-esta-inactivo')
        }`,
      )
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('products.no-se-pudo-cambiar-el-estado'),
        reason instanceof Error ? reason.message : t('products.error-inesperado'),
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('products.productos')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">{t('products.catalogo-de-productos')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('products.nuevo-producto')}
        </Button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="card flex flex-col gap-3 lg:flex-row lg:items-end">
        <Input
          type="search"
          aria-label={t('products.buscar-productos')}
          placeholder={t('products.buscar-por-nombre-o-sku')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="lg:flex-1"
        />
        <Select
          aria-label={t('products.filtrar-por-categoria')}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : '')}
          className="lg:w-48"
        >
          <option value="">{t('products.todas-las-categorias')}</option>
          {getProductCategories().map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('products.filtrar-por-estado')}
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive' | '')}
          className="lg:w-40"
        >
          <option value="">{t('products.todos')}</option>
          <option value="active">{t('products.activos')}</option>
          <option value="inactive">{t('products.inactivos')}</option>
        </Select>
        <Checkbox
          label={t('products.solo-stock-bajo')}
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
                {t('products.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && products.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('products.producto'),
              t('products.categoria'),
              t('products.precio'),
              t('products.stock'),
              t('products.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('products.cargando-productos')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState
            title={t('products.sin-productos')}
            description={t('products.no-hay-registros-que-coincidan-con-la-busqueda')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('products.nuevo-producto')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            headers={[
              t('products.producto'),
              t('products.categoria'),
              t('products.precio'),
              t('products.stock'),
              t('products.estado'),
              t('products.acciones'),
            ]}
          >
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
                      {t('products.costo')} {formatCurrency(product.cost_price)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {product.current_stock} {product.unit}
                    </div>
                    <div className="text-caption text-gray-500">
                      {t('products.min')} {product.min_stock}
                    </div>
                    {stock && (
                      <div className="mt-1">
                        <Badge variant={stock.variant}>{t(stock.label)}</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>
                      {product.status === 'active' ? t('products.activo') : t('products.inactivo')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        aria-label={`${t('products.editar')} ${product.name}`}
                        title={t('products.editar')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(product)}
                        aria-label={
                          product.status === 'active'
                            ? `${t('products.desactivar')} ${product.name}`
                            : `${t('products.activar')} ${product.name}`
                        }
                        title={product.status === 'active' ? t('products.desactivar') : t('products.activar')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Power aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </DataTable>

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
