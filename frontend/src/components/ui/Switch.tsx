import { cn } from '@/utils/cn'

/**
 * Interruptor (switch) para activar o desactivar automatizaciones.
 * Estado activo con el azul corporativo #1E3A8A (txt §1).
 */

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Texto accesible del interruptor. */
  label: string
  disabled?: boolean
  className?: string
}

export default function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-gray-300',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-subtle transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
