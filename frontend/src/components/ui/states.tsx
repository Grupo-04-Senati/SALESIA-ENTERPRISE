import type { ComponentType, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Estados de UI (txt §8): spinner, skeleton, vacío y error.
 */

/** Icono compatible con los estados (cualquier icono de lucide). */
type StateIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

interface SpinnerProps {
  /** Tamaño en píxeles (por defecto 20). */
  size?: number
  className?: string
}

/**
 * Spinner circular (txt §8: color LOADING #3B82F6, 24px).
 * El color sigue a `currentColor` (para que el de botones cargando
 * coincida con su texto); pasar `className="text-loading"` para el azul.
 */
export function Spinner({ size = 24, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 8)),
      }}
      className={cn(
        'inline-block animate-spin rounded-full border-solid border-current border-t-transparent',
        className,
      )}
    />
  )
}

/** Bloque de esqueleto para carga (txt §8: gris-200 con pulso). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-gray-200', className)} />
}

interface StateProps {
  title?: string
  description?: string
  /** Acción opcional (p. ej. botón "Reintentar"). */
  action?: ReactNode
  icon?: StateIcon
}

/** Estado vacío (txt §8): icono gris-400 de 64px + título + descripción. */
export function EmptyState({
  title = 'Sin datos',
  description,
  action,
  icon: Icon = Inbox,
}: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon aria-hidden="true" className="mb-4 h-16 w-16 text-empty" />
      <h3 className="text-h4 text-gray-600">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-gray-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

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

/** Estado de éxito (txt §8): icono verde 64px + título #065F46 + acción. */
export function SuccessState({
  title = 'Operación exitosa',
  description,
  action,
  icon: Icon = CheckCircle2,
}: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon aria-hidden="true" className="mb-4 h-16 w-16 text-success" />
      <h3 className="text-h4 text-success-fg">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body-sm text-gray-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
