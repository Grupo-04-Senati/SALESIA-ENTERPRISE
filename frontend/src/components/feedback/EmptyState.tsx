import type { ComponentType, ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { useLang } from '@/i18n/i18n'

/** Icono compatible con los estados (cualquier icono de lucide). */
export type StateIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

export interface StateProps {
  title?: string
  description?: string
  /** Acción opcional (p. ej. botón "Reintentar"). */
  action?: ReactNode
  icon?: StateIcon
}

/** Estado vacío (txt §8): icono gris-400 de 64px + título + descripción. */
export function EmptyState({ title, description, action, icon: Icon = Inbox }: StateProps) {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon aria-hidden="true" className="mb-4 h-16 w-16 text-empty" />
      <h3 className="text-h4 text-gray-600">{title ?? t('common.sin-datos')}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-gray-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
