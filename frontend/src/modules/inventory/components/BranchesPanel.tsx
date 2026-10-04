import { useEffect, useState } from 'react'
import { Pencil, Plus, Store, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { createBranch, deleteBranch, listBranches, updateBranch } from '../services/branchService'
import type { Branch, BranchInput } from '../services/branchService'

/** Pestaña «Sucursales» de Inventario: sucursales de la empresa (ENDPOINTS.branches). */

const EMPTY_FORM: BranchInput = { code: '', name: '', address: '', phone: '' }

export default function BranchesPanel() {
  const toast = useToast()

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState<BranchInput>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listBranches()
      .then((result) => {
        if (!cancelled) setBranches(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las sucursales')
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

  const openEdit = (branch: Branch) => {
    setEditing(branch)
    setForm({
      code: branch.code,
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    })
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
    const input: BranchInput = {
      code,
      name,
      address: form.address?.trim() || null,
      phone: form.phone?.trim() || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateBranch(editing.id, input)
        toast.success('Sucursal actualizada', `${name} se guardó correctamente.`)
      } else {
        await createBranch(input)
        toast.success('Sucursal creada', `${name} ya está registrada.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la sucursal.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteBranch(deleting.id)
      toast.success('Sucursal eliminada', `${deleting.name} se quitó del listado.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se pudo eliminar la sucursal.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Puntos de venta y oficinas de la empresa.
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva sucursal
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
      ) : loading && branches.length === 0 ? (
        <div className="card">
          <DataTable headers={['Código', 'Nombre', 'Teléfono', 'Dirección', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando sucursales…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : branches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Store}
            title="Sin sucursales"
            description="Registra la primera sucursal para identificar de dónde provienen tus operaciones."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva sucursal
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Código', 'Nombre', 'Teléfono', 'Dirección', 'Estado', 'Acciones']}>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-mono font-medium text-gray-900">{branch.code}</TableCell>
                <TableCell className="font-medium text-gray-900">{branch.name}</TableCell>
                <TableCell className="text-gray-600">{branch.phone ?? '—'}</TableCell>
                <TableCell className="text-gray-600">{branch.address ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={branch.status === 'inactive' ? 'neutral' : 'success'}>
                    {branch.status === 'inactive' ? 'Inactiva' : 'Activa'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(branch)}
                      aria-label={`Editar ${branch.name}`}
                      title="Editar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(branch)
                      }}
                      aria-label={`Eliminar ${branch.name}`}
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
        title={editing ? 'Editar sucursal' : 'Nueva sucursal'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear sucursal'}
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
              placeholder="Ej. SUC-01"
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
              placeholder="Ej. Sucursal Centro"
            />
          </div>
          <Input
            label="Dirección"
            value={form.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder="Ej. Jr. Comercio 456"
            hint="Opcional"
          />
          <Input
            label="Teléfono"
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="Ej. 01 234 5678"
            hint="Opcional"
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar sucursal"
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
          ¿Eliminar la sucursal <strong>{deleting?.name}</strong>?
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
