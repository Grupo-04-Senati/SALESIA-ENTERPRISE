import { useEffect, useState } from 'react'
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
import { formatCurrency } from '@/utils/formatters'
import {
  createSegment,
  deleteSegment,
  listSegments,
  updateSegment,
} from '../services/segmentService'
import type { CustomerSegment, SegmentInput } from '../services/segmentService'

/** Pestaña «Segmentos» de Clientes: segmentación RF-03 (ENDPOINTS.segments). */

const EMPTY_FORM = { name: '', description: '', min_purchases: '0', min_total: '0' }

export default function SegmentsPanel() {
  const toast = useToast()

  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerSegment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<CustomerSegment | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSegments()
      .then((result) => {
        if (!cancelled) setSegments(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los segmentos')
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

  const openEdit = (segment: CustomerSegment) => {
    setEditing(segment)
    setForm({
      name: segment.name,
      description: segment.description ?? '',
      min_purchases: String(segment.min_purchases),
      min_total: String(segment.min_total),
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (name.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const minPurchases = Number(form.min_purchases)
    const minTotal = Number(form.min_total)
    if (Number.isNaN(minPurchases) || minPurchases < 0) {
      setFormError('Las mínimas compras deben ser un número mayor o igual a 0.')
      return
    }
    if (Number.isNaN(minTotal) || minTotal < 0) {
      setFormError('El monto mínimo debe ser un número mayor o igual a 0.')
      return
    }
    const input: SegmentInput = {
      name,
      description: form.description.trim() || null,
      min_purchases: minPurchases,
      min_total: minTotal,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSegment(editing.id, input)
        toast.success('Segmento actualizado', `${name} se guardó correctamente.`)
      } else {
        await createSegment(input)
        toast.success('Segmento creado', `${name} ya está disponible para clasificar clientes.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el segmento.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteSegment(deleting.id)
      toast.success('Segmento eliminado', `${deleting.name} se quitó de la segmentación.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar el segmento.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Segmentos comerciales con umbrales de compra: clasifican a los clientes del directorio.
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo segmento
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
      ) : loading && segments.length === 0 ? (
        <div className="card">
          <DataTable headers={['Segmento', 'Descripción', 'Mín. compras', 'Mín. monto', 'Clientes', 'Estado', '']}>
            <TableStateRow colSpan={7}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando segmentos…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : segments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title="Sin segmentos"
            description="Aún no hay segmentos. Crea el primero para empezar a clasificar a tus clientes."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo segmento
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={['Segmento', 'Descripción', 'Mín. compras', 'Mín. monto', 'Clientes', 'Estado', 'Acciones']}
          >
            {segments.map((segment) => (
              <TableRow key={segment.id}>
                <TableCell className="font-medium text-gray-900">{segment.name}</TableCell>
                <TableCell className="text-gray-600">{segment.description ?? '—'}</TableCell>
                <TableCell>{segment.min_purchases}</TableCell>
                <TableCell>{formatCurrency(segment.min_total)}</TableCell>
                <TableCell>{segment.customer_count}</TableCell>
                <TableCell>
                  <Badge variant={segment.status === 'inactive' ? 'neutral' : 'success'}>
                    {segment.status === 'inactive' ? 'Inactivo' : 'Activo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(segment)}
                      aria-label={`Editar ${segment.name}`}
                      title="Editar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(segment)
                      }}
                      aria-label={`Eliminar ${segment.name}`}
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
        title={editing ? 'Editar segmento' : 'Nuevo segmento'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear segmento'}
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
            placeholder="Ej. Mayoristas"
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label="Descripción"
            hint="Opcional. Describe qué clientes agrupa este segmento."
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Ej. Clientes con volumen de compra alto"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Mín. compras"
              type="number"
              min={0}
              step={1}
              value={form.min_purchases}
              onChange={(event) => setForm({ ...form, min_purchases: event.target.value })}
              hint="Compras mínimas para pertenecer"
            />
            <Input
              label="Mín. monto"
              type="number"
              min={0}
              step="0.01"
              value={form.min_total}
              onChange={(event) => setForm({ ...form, min_total: event.target.value })}
              hint="Monto acumulado mínimo (S/)"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar segmento"
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
          ¿Eliminar el segmento <strong>{deleting?.name}</strong>? Los clientes que lo usan
          conservan su segmentación actual.
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
