import { useEffect, useMemo, useState } from 'react'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/utils/formatters'
import { getState } from '@/data/store'
import { useDataVersion } from '@/data/DataProvider'
import {
  createInteraction,
  deleteInteraction,
  listInteractions,
  updateInteraction,
} from '../services/interactionService'
import type {
  CustomerInteraction,
  InteractionInput,
  InteractionKind,
} from '../services/interactionService'
import { useLang } from '@/i18n/i18n'

/** Pestaña «Interacciones» de Clientes: CRM (ENDPOINTS.interactions). */

const KINDS: InteractionKind[] = ['note', 'call', 'email', 'meeting', 'visit']

const KIND_LABEL_KEYS: Record<InteractionKind, string> = {
  note: 'customers.nota',
  call: 'customers.llamada',
  email: 'customers.correo',
  meeting: 'customers.reunion',
  visit: 'customers.visita',
}

const KIND_BADGES: Record<InteractionKind, BadgeVariant> = {
  note: 'neutral',
  call: 'info',
  email: 'primary',
  meeting: 'success',
  visit: 'warning',
}

const EMPTY_FORM = {
  customer_id: '',
  kind: 'note' as InteractionKind,
  subject: '',
  notes: '',
  occurred_at: '',
}

const pad = (value: number) => String(value).padStart(2, '0')

function toInputDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function InteractionsPanel() {
  const { t } = useLang()
  const toast = useToast()
  const version = useDataVersion()
  const customers = useMemo(() => getState().customers, [version])

  const [items, setItems] = useState<CustomerInteraction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerInteraction | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<CustomerInteraction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listInteractions()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('customers.no-se-pudieron-cargar-las-interacciones'),
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

  const openEdit = (row: CustomerInteraction) => {
    setEditing(row)
    setForm({
      customer_id: String(row.customer_id),
      kind: row.kind,
      subject: row.subject,
      notes: row.notes ?? '',
      occurred_at: toInputDateTime(row.occurred_at),
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    const customerId = Number(form.customer_id)
    const subject = form.subject.trim()
    if (!customerId) {
      setFormError(t('customers.selecciona-el-cliente-de-la-interaccion'))
      return
    }
    if (subject.length < 3) {
      setFormError(t('customers.el-asunto-debe-tener-al-menos-3-caracteres'))
      return
    }
    const input: InteractionInput = {
      customer_id: customerId,
      kind: form.kind,
      subject,
      notes: form.notes.trim() || null,
      occurred_at: form.occurred_at || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateInteraction(editing.id, input)
        toast.success(
          t('customers.interaccion-actualizada'),
          `${subject} ${t('customers.se-guardo-correctamente')}`,
        )
      } else {
        await createInteraction(input)
        toast.success(
          t('customers.interaccion-registrada'),
          `${subject} ${t('customers.quedo-en-la-ficha-del-cliente')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : t('customers.no-se-pudo-guardar-la-interaccion'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteInteraction(deleting.id)
      toast.success(
        t('customers.interaccion-eliminada'),
        `${deleting.subject} ${t('customers.se-quito-del-historial')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : t('customers.no-se-pudo-eliminar-la-interaccion'),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('customers.llamadas-correos-reuniones-y-visitas-registradas-con-tus-clientes')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('customers.nueva-interaccion')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('customers.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('customers.fecha'), t('customers.cliente'), t('customers.tipo'), t('customers.asunto'), t('customers.registro'), '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('customers.cargando-interacciones')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={History}
            title={t('customers.sin-interacciones')}
            description={t(
              'customers.todavia-no-registras-contacto-con-tus-clientes-crea-la-primera-interaccion-para-llevar-la-traza-del-crm',
            )}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('customers.nueva-interaccion')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={[t('customers.fecha'), t('customers.cliente'), t('customers.tipo'), t('customers.asunto'), t('customers.registro'), t('customers.acciones')]}>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  {row.occurred_at ? formatDateTime(row.occurred_at) : '—'}
                </TableCell>
                <TableCell className="font-medium text-gray-900">{row.customer_name}</TableCell>
                <TableCell>
                  <Badge variant={KIND_BADGES[row.kind]}>{t(KIND_LABEL_KEYS[row.kind])}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">{row.subject}</div>
                  {row.notes && (
                    <div className="max-w-64 truncate text-caption text-gray-500">{row.notes}</div>
                  )}
                </TableCell>
                <TableCell className="text-gray-600">{row.performed_by_name ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      aria-label={`${t('customers.editar')} ${row.subject}`}
                      title={t('customers.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(row)
                      }}
                      aria-label={`${t('customers.eliminar')} ${row.subject}`}
                      title={t('customers.eliminar')}
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
        title={editing ? t('customers.editar-interaccion') : t('customers.nueva-interaccion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('customers.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('customers.guardar-cambios') : t('customers.registrar-interaccion')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('customers.cliente')}
            required
            value={form.customer_id}
            onChange={(event) => setForm({ ...form, customer_id: event.target.value })}
            error={formError ?? undefined}
            autoFocus
          >
            <option value="">{t('customers.selecciona-un-cliente')}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('customers.tipo')}
              required
              value={form.kind}
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value as InteractionKind })
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(KIND_LABEL_KEYS[kind])}
                </option>
              ))}
            </Select>
            <Input
              label={t('customers.fecha-y-hora')}
              type="datetime-local"
              value={form.occurred_at}
              onChange={(event) => setForm({ ...form, occurred_at: event.target.value })}
              hint={t('customers.vacio-fecha-actual')}
            />
          </div>
          <Input
            label={t('customers.asunto')}
            required
            minLength={3}
            maxLength={150}
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            placeholder={t('customers.ej-llamada-de-seguimiento')}
          />
          <Textarea
            label={t('customers.notas')}
            hint={t('customers.opcional-detalle-de-lo-tratado-en-el-contacto')}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder={t('customers.ej-interesado-en-el-plan-anual')}
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('customers.eliminar-interaccion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('customers.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('customers.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('customers.eliminar-la-interaccion')} <strong>{deleting?.subject}</strong>{' '}
          {t('customers.registrada-con')} {deleting?.customer_name}?
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
