import { useEffect, useState } from 'react'
import { Pencil, Plus, Ruler, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { createUnit, deleteUnit, listUnits, updateUnit } from '../services/unitService'
import type { Unit, UnitInput } from '../services/unitService'

/** Pestaña «Unidades» de Inventario: unidades de medida (ENDPOINTS.units). */

const EMPTY_FORM: UnitInput = { name: '', symbol: '' }

export default function UnitsPanel() {
  const toast = useToast()

  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm] = useState<UnitInput>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Unit | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listUnits()
      .then((result) => {
        if (!cancelled) setUnits(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las unidades')
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

  const openEdit = (unit: Unit) => {
    setEditing(unit)
    setForm({ name: unit.name, symbol: unit.symbol ?? '' })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (name.length < 1) {
      setFormError('El nombre de la unidad es obligatorio.')
      return
    }
    const input: UnitInput = { name, symbol: form.symbol?.trim() || null }
    setSaving(true)
    try {
      if (editing) {
        await updateUnit(editing.id, input)
        toast.success('Unidad actualizada', `${name} se guardó correctamente.`)
      } else {
        await createUnit(input)
        toast.success('Unidad creada', `${name} ya está disponible para productos.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la unidad.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteUnit(deleting.id)
      toast.success('Unidad eliminada', `${deleting.name} se quitó del listado.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la unidad.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Unidades de medida disponibles para los productos (UND, KG, CJA…).
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva unidad
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
      ) : loading && units.length === 0 ? (
        <div className="card">
          <DataTable headers={['Unidad', 'Símbolo', 'Estado', '']}>
            <TableStateRow colSpan={4}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando unidades…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : units.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Ruler}
            title="Sin unidades"
            description="Crea la primera unidad de medida para poder asignarla a tus productos."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva unidad
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Unidad', 'Símbolo', 'Estado', 'Acciones']}>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium text-gray-900">{unit.name}</TableCell>
                <TableCell className="font-mono text-gray-600">{unit.symbol ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={unit.status === 'inactive' ? 'neutral' : 'success'}>
                    {unit.status === 'inactive' ? 'Inactiva' : 'Activa'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(unit)}
                      aria-label={`Editar ${unit.name}`}
                      title="Editar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(unit)
                      }}
                      aria-label={`Eliminar ${unit.name}`}
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
        title={editing ? 'Editar unidad' : 'Nueva unidad'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear unidad'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            required
            maxLength={30}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ej. Unidad"
            error={formError ?? undefined}
            autoFocus
          />
          <Input
            label="Símbolo"
            maxLength={10}
            value={form.symbol ?? ''}
            onChange={(event) => setForm({ ...form, symbol: event.target.value })}
            placeholder="Ej. UND"
            hint="Opcional. Abreviatura que se muestra en los productos."
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar unidad"
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
          ¿Eliminar la unidad <strong>{deleting?.name}</strong>? Solo es posible si ningún producto
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
