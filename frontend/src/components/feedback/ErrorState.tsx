import { AlertTriangle } from 'lucide-react'
import type { StateProps } from './EmptyState'

/** Estado de error (txt §8): icono 64px rojo + título #991B1B + reintento. */
export function ErrorState({
  title = 'Error al cargar',
  description,
  action,
  icon: Icon = AlertTriangle,
}: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon aria-hidden="true" className="mb-4 h-16 w-16 text-error" />
      <h3 className="text-h4 text-error-fg">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
