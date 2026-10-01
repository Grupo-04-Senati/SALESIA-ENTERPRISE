import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from './states'

/**
 * Botón del sistema de diseño (txt §5.1):
 * primario azul, secundario cyan, outline y peligro.
 * `size="sm"` es una variante compacta para tablas y barras de filtros.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  /** Muestra spinner y bloquea el botón mientras dure la operación. */
  loading?: boolean
  children?: ReactNode
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'border border-primary bg-transparent text-primary hover:bg-gray-100',
  danger: 'bg-error text-white hover:bg-[#DC2626]',
}

const SIZES = {
  sm: 'px-4 py-2 text-caption',
  md: 'px-6 py-3 text-body-sm',
} as const

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
}
