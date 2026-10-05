import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useLang } from '@/i18n/i18n'
import NotificationDetailModal from '@/components/ui/NotificationDetailModal'
import { isNotificationRead } from '@/modules/settings/services/systemService'
import type { AppNotification } from '@/modules/settings/services/systemService'

/**
 * Campana de notificaciones (Diseño E): conectada al endpoint real
 * /api/v1/notifications. El badge muestra las no leídas (oculto si no
 * hay); pulsar una notificación la marca como leída y abre su detalle
 * (cambios + quién la leyó) con enlace «Ir al módulo».
 */

const LEVEL_STYLES: Record<string, { icon: typeof Info; box: string }> = {
  error: { icon: CircleX, box: 'bg-error-bg text-error-fg' },
  warning: { icon: TriangleAlert, box: 'bg-warning-bg text-warning-fg' },
  success: { icon: CircleCheck, box: 'bg-success-bg text-success-fg' },
  info: { icon: Info, box: 'bg-[#E8EEFF] text-primary' },
}

function relativeTime(iso: string, locale: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
  ]
  try {
    if (abs < 60_000) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'minute')
    if (abs < 3_600_000) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(diffMs / units[0][1]),
        'minute',
      )
    }
    if (abs < 86_400_000) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(diffMs / units[1][1]),
        'hour',
      )
    }
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      Math.round(diffMs / units[2][1]),
      'day',
    )
  } catch {
    return ''
  }
}

export default function NotificationsMenu() {
  const { t, lang } = useLang()
  const { items, unread, loading, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AppNotification | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const visible = useMemo(() => items.slice(0, 12), [items])

  // Refleja el estado leído/no leído actualizado del hook.
  const active = selected
    ? (items.find((item) => item.id === selected.id) ?? selected)
    : null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`${t('topbar.notifications')}${unread > 0 ? ` (${unread})` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-primary hover:text-white"
      >
        <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notif.title')}
          className="animate-drop-in absolute right-0 top-11 z-50 w-[350px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_40px_rgba(16,24,40,0.16)] dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
              {t('notif.title')}
            </p>
            {unread > 0 && (
              <span className="rounded-full bg-[#E8EEFF] px-2 py-px text-[11px] font-medium text-primary">
                {unread}
              </span>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-caption text-gray-500">
                {t('notif.loading')}
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-7 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700">
                  <Bell aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="mt-2 text-caption text-gray-500 dark:text-gray-400">
                  {t('notif.empty')}
                </p>
              </div>
            ) : (
              <ul>
                {visible.map((item) => {
                  const style = LEVEL_STYLES[item.level] ?? LEVEL_STYLES.info
                  const Icon = style.icon
                  const isUnread = !isNotificationRead(item)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isUnread) void markRead(item.id)
                          setOpen(false)
                          setSelected(item)
                        }}
                        className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-700/60 dark:hover:bg-gray-700/50 ${
                          isUnread ? 'bg-[#F7F9FF] dark:bg-[#161C2E]' : ''
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.box}`}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                              {item.title}
                            </span>
                            {isUnread && (
                              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-4 text-gray-500 dark:text-gray-400">
                            {item.message}
                          </span>
                          <span className="mt-1 block text-[11px] text-gray-400">
                            {relativeTime(item.created_at, lang)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {unread > 0 && visible.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-2.5 text-center dark:border-gray-700">
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 text-caption font-medium text-primary hover:underline"
              >
                <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
                {t('notif.markAll')}
              </button>
            </div>
          )}
        </div>
      )}

      <NotificationDetailModal notification={active} onClose={() => setSelected(null)} />
    </div>
  )
}
