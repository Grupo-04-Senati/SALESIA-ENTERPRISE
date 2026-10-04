import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Notificaciones reales del sistema (GET /api/v1/notifications).
 * El badge cuenta las no leídas; el panel lista las últimas y
 * permite marcar una o todas como leídas. Si no hay, no hay badge.
 */

export interface AppNotification {
  id: number
  level: string
  title: string
  message: string
  read_at: string | null
  created_at: string
}

interface Page<T> {
  items: T[]
  total: number
}

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

  const markRead = useCallback(
    async (id: number) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
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
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })))
    try {
      await apiFetch(`${ENDPOINTS.notifications}/read-all`, { method: 'POST' })
    } catch {
      void refresh()
    }
  }, [refresh])

  const unread = items.filter((item) => item.read_at === null).length

  return { items, unread, loading, refresh, markRead, markAllRead }
}
