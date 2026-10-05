import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Download, Layers, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import NotificationDetailModal from '@/components/ui/NotificationDetailModal'
import { Input, Select, Textarea } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime } from '@/utils/formatters'
import { cleanText, hasLetter, maxLength, minLength } from '@/utils/validators'
import { ROLES } from '@/modules/auth/services/authService'
import {
  clearNotifications,
  createNotification,
  deleteNotification,
  downloadNotificationsCsv,
  getNotificationsConfig,
  isNotificationRead,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationsConfig,
} from '../services/systemService'
import type {
  AppNotification,
  NotificationLevel,
  NotificationModuleConfig,
} from '../services/systemService'

/**
 * Pestaña «Notificaciones» de Configuración (ENDPOINTS.notifications):
 * historial, CSV, vaciar, alta manual (Admin) y matriz módulo → roles.
 */

const LEVELS: NotificationLevel[] = ['info', 'warning', 'success', 'error']

const LEVEL_BADGES: Record<NotificationLevel, BadgeVariant> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
}

const EMPTY_FORM = { title: '', message: '', level: 'info' as NotificationLevel }

const LEVEL_KEYS: Record<NotificationLevel, string> = {
  info: 'settings.nivel-info',
  warning: 'settings.nivel-advertencia',
  success: 'settings.nivel-exito',
  error: 'settings.nivel-error',
}

export default function NotificationsPanel() {
  const toast = useToast()
  const { t } = useLang()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

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

  // Detalle al hacer click en una fila del historial.
  const [selected, setSelected] = useState<AppNotification | null>(null)

  // Exportar CSV y vaciar historial.
  const [exporting, setExporting] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  // Matriz módulo → roles (solo Admin).
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [modules, setModules] = useState<NotificationModuleConfig[]>([])
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)
  const [savingMatrix, setSavingMatrix] = useState(false)

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
            reason instanceof Error
              ? reason.message
              : t('settings.no-se-pudieron-cargar-las-notificaciones'),
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
    const title = cleanText(form.title)
    const message = cleanText(form.message)
    const titleError =
      minLength(3, t('settings.el-titulo-debe-tener-al-menos-3-caracteres'))(title) ??
      maxLength(150)(title) ??
      hasLetter()(title)
    if (titleError) {
      setFormError(titleError)
      return
    }
    const messageError =
      minLength(3, t('settings.el-mensaje-debe-tener-al-menos-3-caracteres'))(message) ??
      maxLength(2000)(message)
    if (messageError) {
      setFormError(messageError)
      return
    }
    setSaving(true)
    try {
      await createNotification({ title, message, level: form.level })
      toast.success(
        t('settings.notificacion-creada'),
        `${title} ${t('settings.se-envio-a-la-empresa')}`,
      )
      setFormOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error
          ? reason.message
          : t('settings.no-se-pudo-crear-la-notificacion'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleMarkRead = async (row: AppNotification) => {
    try {
      await markNotificationRead(row.id)
      toast.success(t('settings.notificacion-leida'), row.title)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('settings.no-se-pudo-marcar'),
        reason instanceof Error ? reason.message : t('settings.error-inesperado'),
      )
    }
  }

  const openDetail = (row: AppNotification) => {
    setSelected(row)
    if (!isNotificationRead(row)) {
      markNotificationRead(row.id)
        .then(reload)
        .catch(() => undefined)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      const result = await markAllNotificationsRead()
      toast.success(
        t('settings.notificaciones-leidas'),
        t('settings.marcadas-como-leidas', { n: result.updated }),
      )
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('settings.no-se-pudieron-marcar'),
        reason instanceof Error ? reason.message : t('settings.error-inesperado'),
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
      toast.success(t('settings.notificacion-eliminada'), deleting.title)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : t('settings.no-se-pudo-eliminar-la-notificacion'),
      )
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadNotificationsCsv()
      toast.success('CSV descargado', 'El historial de notificaciones se descargó en tu equipo.')
    } catch (reason: unknown) {
      toast.error(
        'No se pudo descargar',
        reason instanceof Error ? reason.message : t('settings.error-inesperado'),
      )
    } finally {
      setExporting(false)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    setClearError(null)
    try {
      const result = await clearNotifications()
      toast.success('Historial vaciado', `${result.deleted} notificaciones eliminadas.`)
      setClearOpen(false)
      reload()
    } catch (reason: unknown) {
      setClearError(reason instanceof Error ? reason.message : t('settings.error-inesperado'))
    } finally {
      setClearing(false)
    }
  }

  const openMatrix = () => {
    setMatrixOpen(true)
    setMatrixLoading(true)
    setMatrixError(null)
    getNotificationsConfig()
      .then((result) => setModules(result.modules))
      .catch((reason: unknown) => {
        setMatrixError(
          reason instanceof Error ? reason.message : 'No se pudo cargar la configuración.',
        )
      })
      .finally(() => setMatrixLoading(false))
  }

  const toggleRole = (key: string, role: string) =>
    setModules((current) =>
      current.map((module) =>
        module.key === key
          ? {
              ...module,
              roles: module.roles.includes(role)
                ? module.roles.filter((value) => value !== role)
                : [...module.roles, role],
            }
          : module,
      ),
    )

  const handleSaveMatrix = async () => {
    setSavingMatrix(true)
    setMatrixError(null)
    try {
      const payload = Object.fromEntries(modules.map((module) => [module.key, module.roles]))
      const result = await updateNotificationsConfig(payload)
      setModules(result.modules)
      toast.success('Configuración guardada', 'Los destinatarios por módulo se actualizaron.')
      setMatrixOpen(false)
    } catch (reason: unknown) {
      setMatrixError(reason instanceof Error ? reason.message : 'No se pudo guardar.')
    } finally {
      setSavingMatrix(false)
    }
  }

  const unread = items.filter((row) => !isNotificationRead(row)).length

  // Refleja el estado leído/no leído actualizado tras recargar.
  const active = selected
    ? (items.find((row) => row.id === selected.id) ?? selected)
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('settings.avisos-de-la-empresa-sin-leer', { n: unread })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport} loading={exporting}>
            <Download aria-hidden="true" className="h-4 w-4" />
            Descargar CSV
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setClearError(null)
                setClearOpen(true)
              }}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Vaciar historial
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={openMatrix}>
              <Layers aria-hidden="true" className="h-4 w-4" />
              Módulos y roles
            </Button>
          )}
          <Button variant="outline" onClick={handleMarkAllRead} loading={markingAll}>
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
            {t('settings.marcar-todas-como-leidas')}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => {
                setForm(EMPTY_FORM)
                setFormError(null)
                setFormOpen(true)
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t('settings.nueva-notificacion')}
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('settings.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && items.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('settings.fecha'),
              t('settings.nivel'),
              t('settings.titulo'),
              t('settings.mensaje'),
              t('settings.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('settings.cargando-notificaciones')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Bell}
            title={t('settings.sin-notificaciones')}
            description={t('settings.todavia-no-hay-avisos-registrados')}
            action={
              isAdmin ? (
                <Button
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setFormError(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {t('settings.nueva-notificacion')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('settings.fecha'),
              t('settings.nivel'),
              t('settings.titulo'),
              t('settings.mensaje'),
              t('settings.estado'),
              t('settings.acciones'),
            ]}
          >
            {items.map((row) => (
              <TableRow key={row.id} onClick={() => openDetail(row)}>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={LEVEL_BADGES[row.level]}>
                    {t(LEVEL_KEYS[row.level])}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{row.title}</TableCell>
                <TableCell className="max-w-64 truncate text-gray-600">{row.message}</TableCell>
                <TableCell>
                  <Badge variant={isNotificationRead(row) ? 'neutral' : 'warning'}>
                    {isNotificationRead(row) ? t('settings.leida') : t('settings.sin-leer')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {!isNotificationRead(row) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleMarkRead(row)
                        }}
                        aria-label={`${t('settings.marcar')} ${row.title} ${t('settings.como-leida')}`}
                        title={t('settings.marcar-como-leida')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <CheckCheck aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteError(null)
                        setDeleting(row)
                      }}
                      aria-label={`${t('settings.eliminar')} ${row.title}`}
                      title={t('settings.eliminar')}
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
        title={t('settings.nueva-notificacion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('settings.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {t('settings.crear-notificacion')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('settings.titulo')}
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder={t('settings.ej-cierre-de-caja-pendiente')}
            error={formError ?? undefined}
            autoFocus
          />
          <Textarea
            label={t('settings.mensaje')}
            required
            minLength={3}
            maxLength={2000}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder={t('settings.ej-recuerda-registrar-los-ingresos-del-turno')}
          />
          <Select
            label={t('settings.nivel')}
            required
            value={form.level}
            onChange={(event) =>
              setForm({ ...form, level: event.target.value as NotificationLevel })
            }
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(LEVEL_KEYS[level])}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('settings.eliminar-notificacion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('settings.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('settings.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('settings.eliminar-la-notificacion')} <strong>{deleting?.title}</strong>?
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deleteError}
          </p>
        )}
      </Modal>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Vaciar historial"
        footer={
          <>
            <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
              {t('settings.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleClear} loading={clearing}>
              Vaciar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          Se eliminarán <strong>todas</strong> las notificaciones de la empresa. Descarga primero
          el CSV si quieres conservarlas.
        </p>
        {clearError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {clearError}
          </p>
        )}
      </Modal>

      <Modal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        title="Módulos y roles"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setMatrixOpen(false)} disabled={savingMatrix}>
              {t('settings.cancelar')}
            </Button>
            <Button onClick={handleSaveMatrix} loading={savingMatrix} disabled={matrixLoading}>
              Guardar
            </Button>
          </>
        }
      >
        {matrixLoading ? (
          <p className="flex items-center gap-2 py-6 text-caption text-gray-500">
            <Spinner size={16} className="text-loading" />
            Cargando configuración…
          </p>
        ) : matrixError ? (
          <p className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {matrixError}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-body-sm text-gray-600">
              Elige qué roles reciben notificaciones de cada módulo. Los cambios afectan a los
              avisos futuros.
            </p>
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-body-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200 text-caption text-gray-600">
                    <th className="px-3 py-2 text-left font-medium">Módulo</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-2 py-2 text-center font-medium">
                        {role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => (
                    <tr key={module.key} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-3 py-2 font-medium text-gray-900">{module.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={module.roles.includes(role)}
                            onChange={() => toggleRole(module.key, role)}
                            aria-label={`${module.label} — ${role}`}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <NotificationDetailModal notification={active} onClose={() => setSelected(null)} />
    </div>
  )
}
