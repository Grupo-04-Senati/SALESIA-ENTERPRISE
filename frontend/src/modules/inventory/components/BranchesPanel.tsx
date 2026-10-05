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
import { useLang } from '@/i18n/i18n'
import { cleanText, code, hasLetter, maxLength, minLength, phone, required } from '@/utils/validators'
import { createBranch, deleteBranch, listBranches, updateBranch } from '../services/branchService'
import type { Branch, BranchInput } from '../services/branchService'

/** Pestaña «Sucursales» de Inventario: sucursales de la empresa (ENDPOINTS.branches). */

const EMPTY_FORM: BranchInput = { code: '', name: '', address: '', phone: '' }

export default function BranchesPanel() {
  const { t } = useLang()
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
          setError(
            reason instanceof Error ? reason.message : t('inventory.no-se-pudieron-cargar-las-sucursales'),
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
    const branchCode = cleanText(form.code)
    const name = cleanText(form.name)
    const address = cleanText(form.address ?? '')
    const phoneValue = cleanText(form.phone ?? '')
    const codeError = required(t('inventory.el-codigo-es-obligatorio'))(branchCode) ?? code(20)(branchCode)
    if (codeError) {
      setFormError(codeError)
      return
    }
    const nameError =
      minLength(2, t('inventory.el-nombre-debe-tener-al-menos-2-caracteres'))(name) ??
      maxLength(120)(name) ??
      hasLetter()(name)
    if (nameError) {
      setFormError(nameError)
      return
    }
    const addressError = maxLength(255)(address)
    if (addressError) {
      setFormError(addressError)
      return
    }
    const phoneError = maxLength(20)(phoneValue) ?? phone()(phoneValue)
    if (phoneError) {
      setFormError(phoneError)
      return
    }
    const input: BranchInput = {
      code: branchCode,
      name,
      address: address || null,
      phone: phoneValue || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateBranch(editing.id, input)
        toast.success(t('inventory.sucursal-actualizada'), `${name} ${t('inventory.guardado-correctamente')}`)
      } else {
        await createBranch(input)
        toast.success(t('inventory.sucursal-creada'), `${name} ${t('inventory.ya-esta-registrada')}`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-guardar-la-sucursal'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteBranch(deleting.id)
      toast.success(t('inventory.sucursal-eliminada'), `${deleting.name} ${t('inventory.se-quito-del-listado')}`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : t('inventory.no-se-pudo-eliminar-la-sucursal'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('inventory.puntos-de-venta-y-oficinas-de-la-empresa')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('inventory.nueva-sucursal')}
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
      ) : loading && branches.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('inventory.codigo'),
              t('inventory.nombre'),
              t('inventory.telefono'),
              t('inventory.direccion'),
              t('inventory.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('inventory.cargando-sucursales')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : branches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Store}
            title={t('inventory.sin-sucursales')}
            description={t(
              'inventory.registra-la-primera-sucursal-para-identificar-de-donde-provienen-tus-operaciones',
            )}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('inventory.nueva-sucursal')}
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
              t('inventory.telefono'),
              t('inventory.direccion'),
              t('inventory.estado'),
              t('inventory.acciones'),
            ]}
          >
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-mono font-medium text-gray-900">{branch.code}</TableCell>
                <TableCell className="font-medium text-gray-900">{branch.name}</TableCell>
                <TableCell className="text-gray-600">{branch.phone ?? '—'}</TableCell>
                <TableCell className="text-gray-600">{branch.address ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={branch.status === 'inactive' ? 'neutral' : 'success'}>
                    {branch.status === 'inactive' ? t('inventory.inactiva') : t('inventory.activa')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(branch)}
                      aria-label={`${t('inventory.editar')} ${branch.name}`}
                      title={t('inventory.editar')}
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
                      aria-label={`${t('inventory.eliminar')} ${branch.name}`}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('inventory.editar-sucursal') : t('inventory.nueva-sucursal')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('inventory.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('inventory.guardar-cambios') : t('inventory.crear-sucursal')}
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
              placeholder={t('inventory.ej-suc-01')}
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
              placeholder={t('inventory.ej-sucursal-centro')}
            />
          </div>
          <Input
            label={t('inventory.direccion')}
            maxLength={255}
            value={form.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
            placeholder={t('inventory.ej-jr-comercio-456')}
            hint={t('inventory.opcional')}
          />
          <Input
            label={t('inventory.telefono')}
            maxLength={20}
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder={t('inventory.ej-01-234-5678')}
            hint={t('inventory.opcional')}
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('inventory.eliminar-sucursal')}
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
          {t('inventory.eliminar-la-sucursal')} <strong>{deleting?.name}</strong>?
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
