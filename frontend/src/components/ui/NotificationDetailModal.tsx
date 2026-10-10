import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import { Spinner } from '@/components/feedback/Loader'
import { useLang } from '@/i18n/i18n'
import { formatDateTime } from '@/utils/formatters'
import {
  isNotificationRead,
  listNotificationReaders,
} from '@/modules/settings/services/systemService'
import type {
  AppNotification,
  NotificationReader,
} from '@/modules/settings/services/systemService'

/**
 * Detalle de una notificación: pestaña «Cambios» (qué cambió y quién)
 * y «Leído por» (quién del equipo ya la leyó). «Ir al módulo» lleva
 * a la ruta relacionada (notification.link).
 */

const TAB_ITEMS = [
  { id: 'cambios', label: 'Cambios' },
  { id: 'lectura', label: 'Leído por' },
]

const MODULE_LABELS: Record<string, string> = {
  productos: 'Productos',
  categorias: 'Categorías',
  inventario: 'Inventario',
  ventas: 'Ventas',
  clientes: 'Clientes',
  vendedores: 'Vendedores',
  compras: 'Compras',
  cotizaciones: 'Cotizaciones',
  devoluciones: 'Devoluciones',
  precios: 'Precios',
  configuracion: 'Configuración',
  reportes: 'Reportes',
  analytics: 'Analytics',
  automatizaciones: 'Automatizaciones',
}

const DETAIL_LABELS: Record<string, string> = {
  action: 'Acción',
  entity: 'Entidad',
  entity_id: 'Registro',
  actor: 'Autor',
  source: 'Origen',
  quote_number: 'Cotización',
  sale_number: 'Venta',
  sale_id: 'Id de venta',
  customer: 'Cliente',
  total: 'Total',
}

interface NotificationDetailModalProps {
  notification: AppNotification | null
  onClose: () => void
}

export default function NotificationDetailModal({
  notification,
  onClose,
}: NotificationDetailModalProps) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [tab, setTab] = useState('cambios')
  const [readers, setReaders] = useState<NotificationReader[] | null>(null)
  const [readersError, setReadersError] = useState<string | null>(null)

  useEffect(() => {
    setTab('cambios')
    setReaders(null)
    setReadersError(null)
  }, [notification?.id])

  useEffect(() => {
    if (!notification || tab !== 'lectura' || readers !== null) return
    let cancelled = false
    listNotificationReaders(notification.id)
      .then((result) => {
        if (!cancelled) setReaders(result.items)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setReaders([])
          setReadersError(reason instanceof Error ? reason.message : 'No se pudo cargar.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [notification, tab, readers])

  if (!notification) return null

  const detail = notification.detail ?? {}
  const detailRows = Object.entries(detail).filter(([, value]) => value !== null && value !== '')
  const fixedRows: [string, string][] = [
    ['Módulo', MODULE_LABELS[notification.module ?? ''] ?? notification.module ?? '—'],
    [
      'Destinatario',
      notification.target_role
        ? t(notification.target_role)
        : 'Todos',
    ],
    ['Autor', notification.actor_name ?? '—'],
    ['Fecha', formatDateTime(notification.created_at)],
    ['Estado', isNotificationRead(notification) ? 'Leída' : 'Sin leer'],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={notification.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cerrar')}
          </Button>
          {notification.link && (
            <Button
              onClick={() => {
                onClose()
                navigate(notification.link as string)
              }}
            >
              Ir al módulo
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body-sm text-gray-700">{notification.message}</p>

        <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="notif-detalle" />

        <TabPanel tabId="cambios" active={tab === 'cambios'}>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {fixedRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-gray-500">{label}</dt>
                <dd className="text-body-sm font-medium text-gray-900">{value}</dd>
              </div>
            ))}
            {detailRows.map(([key, value]) => (
              <div key={key}>
                <dt className="text-caption text-gray-500">{DETAIL_LABELS[key] ?? key}</dt>
                <dd className="break-all text-body-sm font-medium text-gray-900">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </TabPanel>

        <TabPanel tabId="lectura" active={tab === 'lectura'}>
          {readers === null ? (
            <p className="flex items-center gap-2 py-4 text-caption text-gray-500">
              <Spinner size={16} className="text-loading" />
              Cargando lecturas…
            </p>
          ) : readersError ? (
            <p className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {readersError}
            </p>
          ) : readers.length === 0 ? (
            <p className="py-4 text-center text-caption text-gray-500">
              Nadie ha leído esta notificación todavía.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {readers.map((reader) => (
                <li key={reader.user_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
                    <span className="truncate text-body-sm font-medium text-gray-900">
                      {reader.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-px text-[11px] font-medium text-gray-600">
                      {reader.role}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption text-gray-500">
                    {reader.read_at ? formatDateTime(reader.read_at) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </div>
    </Modal>
  )
}
