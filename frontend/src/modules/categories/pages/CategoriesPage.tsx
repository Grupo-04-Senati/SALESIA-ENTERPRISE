import { useEffect, useMemo, useState } from 'react'
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
import { useDataVersion } from '@/data/DataProvider'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categoryService'
import type { Category, CategoryInput } from '@/types/product'
import { useLang } from '@/i18n/i18n'

/**
 * Página de Categorías (RF-04 · docs/05 §2.4).
 * Alta y edición de categorías de producto: son el requisito previo para
 * poder crear productos (el formulario exige una categoría existente).
 */

const EMPTY_FORM = { name: '', description: '' }

export default function CategoriesPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCategories()
      .then((result) => {
        if (!cancelled) setCategories(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t('categories.no-se-pudieron-cargar-las-categorias'),
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
    return categories.filter((category) => term === '' || category.name.toLowerCase().includes(term))
  }, [categories, search])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setForm({ name: category.name, description: category.description ?? '' })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (name.length < 2) {
      setFormError(t('categories.el-nombre-debe-tener-al-menos-2-caracteres', { n: 2 }))
      return
    }
    const input: CategoryInput = { name, description: form.description.trim() || null }
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, input)
        toast.success(t('categories.categoria-actualizada'), `${name} ${t('categories.se-guardo-correctamente')}`)
      } else {
        await createCategory(input)
        toast.success(t('categories.categoria-creada'), `${name} ${t('categories.ya-esta-disponible-en-productos')}`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : t('categories.no-se-pudo-guardar-la-categoria'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteCategory(deleting.id)
      toast.success(t('categories.categoria-eliminada'), `${deleting.name} ${t('categories.se-quito-del-catalogo')}`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : t('categories.no-se-pudo-eliminar-la-categoria'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('categories.categorias')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">{t('categories.catalogo-de-categorias-de-producto')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('categories.nueva-categoria')}
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label={t('categories.buscar-categorias')}
          placeholder={t('categories.buscar-categoria')}
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
                {t('categories.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && categories.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('categories.categoria'), t('categories.descripcion'), t('categories.estado'), '']}>
            <TableStateRow colSpan={4}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('categories.cargando-categorias')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title={t('categories.sin-categorias')}
            description={t('categories.aun-no-hay-categorias-registradas')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('categories.nueva-categoria')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('categories.categoria'),
              t('categories.descripcion'),
              t('categories.estado'),
              t('categories.acciones'),
            ]}
          >
            {visible.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium text-gray-900">{category.name}</TableCell>
                <TableCell className="text-gray-600">{category.description ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={category.status === 'inactive' ? 'neutral' : 'success'}>
                    {category.status === 'inactive' ? t('categories.inactiva') : t('categories.activa')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`${t('categories.editar')} ${category.name}`}
                      title={t('categories.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(category)
                      }}
                      aria-label={`${t('categories.eliminar')} ${category.name}`}
                      title={t('categories.eliminar')}
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
        title={editing ? t('categories.editar-categoria') : t('categories.nueva-categoria')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('categories.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('categories.guardar-cambios') : t('categories.crear-categoria')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('categories.nombre')}
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={t('categories.ej-bebidas')}
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label={t('categories.descripcion')}
            hint={t('categories.opcional-describe-que-agrupa-esta-categoria')}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder={t('categories.ej-bebidas-frias-y-gaseosas')}
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('categories.eliminar-categoria')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('categories.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('categories.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('categories.eliminar-la-categoria')}
          <strong>{deleting?.name}</strong>
          {t('categories.solo-es-posible-si-ningun-producto-la-esta-usando')}
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
