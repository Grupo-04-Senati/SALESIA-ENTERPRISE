import { CheckCircle2 } from 'lucide-react'
import type { StateProps } from './EmptyState'
import { useLang } from '@/i18n/i18n'

/** Estado de éxito (txt §8): icono verde 64px + título #065F46 + acción. */
export function SuccessState({ title, description, action, icon: Icon = CheckCircle2 }: StateProps) {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon aria-hidden="true" className="mb-4 h-16 w-16 text-success" />
      <h3 className="text-h4 text-success-fg">{title ?? t('common.operacion-exitosa')}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
