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

/**
 * Página de Categorías (RF-04 · docs/05 §2.4).
 * Alta y edición de categorías de producto: son el requisito previo para
 * poder crear productos (el formulario exige una categoría existente).
 */

const EMPTY_FORM = { name: '', description: '' }

export default function CategoriesPage() {
  const toast = useToast()
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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las categorías')
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
      setFormError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const input: CategoryInput = { name, description: form.description.trim() || null }
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, input)
        toast.success('Categoría actualizada', `${name} se guardó correctamente.`)
      } else {
        await createCategory(input)
        toast.success('Categoría creada', `${name} ya está disponible en Productos.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la categoría.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteCategory(deleting.id)
      toast.success('Categoría eliminada', `${deleting.name} se quitó del catálogo.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la categoría.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Categorías</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Catálogo de categorías de producto (RF-04). Crea aquí las categorías de tu proyecto
            antes de registrar productos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label="Buscar categorías"
          placeholder="Buscar categoría…"
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
      ) : loading && categories.length === 0 ? (
        <div className="card">
          <DataTable headers={['Categoría', 'Descripción', 'Estado', '']}>
            <TableStateRow colSpan={4}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando categorías…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title="Sin categorías"
            description="Aún no hay categorías registradas. Crea la primera para poder dar de alta productos."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva categoría
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Categoría', 'Descripción', 'Estado', 'Acciones']}>
            {visible.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium text-gray-900">{category.name}</TableCell>
                <TableCell className="text-gray-600">{category.description ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={category.status === 'inactive' ? 'neutral' : 'success'}>
                    {category.status === 'inactive' ? 'Inactiva' : 'Activa'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Editar ${category.name}`}
                      title="Editar"
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
                      aria-label={`Eliminar ${category.name}`}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ej. Bebidas"
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label="Descripción"
            hint="Opcional. Describe qué agrupa esta categoría."
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Ej. Bebidas frías y gaseosas"
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar categoría"
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
          ¿Eliminar la categoría <strong>{deleting?.name}</strong>? Solo es posible si ningún producto
          la está usando.
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
