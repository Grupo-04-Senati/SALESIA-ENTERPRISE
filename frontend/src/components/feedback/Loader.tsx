import { cn } from '@/utils/cn'
import { useLang } from '@/i18n/i18n'

/**
 * Loader de UI (txt §8): spinner de carga.
 */

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
  const { t } = useLang()
  return (
    <span
      role="status"
      aria-label={t('common.cargando')}
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
