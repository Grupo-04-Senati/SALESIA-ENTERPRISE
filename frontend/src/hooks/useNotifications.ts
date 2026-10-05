import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import type { AppNotification } from '@/modules/settings/services/systemService'
import { isNotificationRead } from '@/modules/settings/services/systemService'

/**
 * Notificaciones reales del sistema (GET /api/v1/notifications).
 * El badge cuenta las no leídas; el panel lista las últimas y
 * permite marcar una o todas como leídas. Refresca cada 45 s
 * mientras la pestaña esté visible (cambios de todos los módulos
 * llegan solos a la campana).
 */

export type { AppNotification }

interface Page<T> {
  items: T[]
  total: number
}

const POLL_MS = 45_000

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const page = await apiFetch<Page<AppNotification>>(
        `${ENDPOINTS.notifications}?page=1&page_size=50`,
      )
      setItems(page.items)
    } catch {
      // Sin API el panel muestra el estado vacío.
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh])

  const markRead = useCallback(
    async (id: number) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, read: true, read_at: item.read_at ?? new Date().toISOString() }
            : item,
        ),
      )
      try {
        await apiFetch(`${ENDPOINTS.notifications}/${id}/read`, { method: 'PATCH' })
      } catch {
        void refresh()
      }
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems((current) =>
      current.map((item) => (isNotificationRead(item) ? item : { ...item, read: true, read_at: now })),
    )
    try {
      await apiFetch(`${ENDPOINTS.notifications}/read-all`, { method: 'POST' })
    } catch {
      void refresh()
    }
  }, [refresh])

  const unread = items.filter((item) => !isNotificationRead(item)).length

  return { items, unread, loading, refresh, markRead, markAllRead }
}
