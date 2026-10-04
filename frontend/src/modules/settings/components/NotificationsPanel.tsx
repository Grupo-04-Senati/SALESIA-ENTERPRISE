import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Plus, Trash2 } from 'lucide-react'
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
import {
  NOTIFICATION_LEVEL_LABELS,
  createNotification,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/systemService'
import type { AppNotification, NotificationLevel } from '../services/systemService'

/** Pestaña «Notificaciones» de Configuración (ENDPOINTS.notifications). */

const LEVELS: NotificationLevel[] = ['info', 'warning', 'success', 'error']

const LEVEL_BADGES: Record<NotificationLevel, BadgeVariant> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
}

const EMPTY_FORM = { title: '', message: '', level: 'info' as NotificationLevel }

export default function NotificationsPanel() {
  const toast = useToast()

  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [deleting, setDeleting] = useState<AppNotification | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listNotifications()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : 'No se pudieron cargar las notificaciones',
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

  const handleSubmit = async () => {
    const title = form.title.trim()
    const message = form.message.trim()
    if (title.length < 3) {
      setFormError('El título debe tener al menos 3 caracteres.')
      return
    }
    if (message.length < 3) {
      setFormError('El mensaje debe tener al menos 3 caracteres.')
      return
    }
    setSaving(true)
    try {
      await createNotification({ title, message, level: form.level })
      toast.success('Notificación creada', `${title} se envió a la empresa.`)
      setFormOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : 'No se pudo crear la notificación.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleMarkRead = async (row: AppNotification) => {
    try {
      await markNotificationRead(row.id)
      toast.success('Notificación leída', row.title)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo marcar',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      const result = await markAllNotificationsRead()
      toast.success('Notificaciones leídas', `${result.updated} marcadas como leídas.`)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudieron marcar',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteNotification(deleting.id)
      toast.success('Notificación eliminada', deleting.title)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'No se pudo eliminar la notificación.',
      )
    }
  }

  const unread = items.filter((row) => !row.read_at).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          Avisos de la empresa. {unread} sin leer.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleMarkAllRead} loading={markingAll}>
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
            Marcar todas como leídas
          </Button>
          <Button
            onClick={() => {
              setForm(EMPTY_FORM)
              setFormError(null)
              setFormOpen(true)
            }}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nueva notificación
          </Button>
        </div>
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
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable headers={['Fecha', 'Nivel', 'Título', 'Mensaje', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando notificaciones…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Todavía no hay avisos registrados. Crea la primera para informar a tu equipo."
            action={
              <Button
                onClick={() => {
                  setForm(EMPTY_FORM)
                  setFormError(null)
                  setFormOpen(true)
                }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva notificación
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Fecha', 'Nivel', 'Título', 'Mensaje', 'Estado', 'Acciones']}>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={LEVEL_BADGES[row.level]}>
                    {NOTIFICATION_LEVEL_LABELS[row.level]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{row.title}</TableCell>
                <TableCell className="max-w-64 truncate text-gray-600">{row.message}</TableCell>
                <TableCell>
                  <Badge variant={row.read_at ? 'neutral' : 'warning'}>
                    {row.read_at ? 'Leída' : 'Sin leer'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {!row.read_at && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(row)}
                        aria-label={`Marcar ${row.title} como leída`}
                        title="Marcar como leída"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <CheckCheck aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(row)
                      }}
                      aria-label={`Eliminar ${row.title}`}
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
        title="Nueva notificación"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Crear notificación
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Título"
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Ej. Cierre de caja pendiente"
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label="Mensaje"
            required
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder="Ej. Recuerda registrar los ingresos del turno."
          />
          <Select
            label="Nivel"
            required
            value={form.level}
            onChange={(event) =>
              setForm({ ...form, level: event.target.value as NotificationLevel })
            }
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {NOTIFICATION_LEVEL_LABELS[level]}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar notificación"
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
          ¿Eliminar la notificación <strong>{deleting?.title}</strong>?
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
