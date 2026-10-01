import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/**
 * Badge de estado (txt §5.6): fondo de color suave + texto oscuro
 * correspondiente a la paleta de estados del sistema de diseño.
 */

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'

const VARIANTS: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  error: 'bg-error-bg text-error-fg',
  info: 'bg-info-bg text-info-fg',
  neutral: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary/10 text-primary',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

export default function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
