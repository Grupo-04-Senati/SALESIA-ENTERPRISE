import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLang } from '@/i18n/i18n'

/**
 * Modal del sistema de diseño (txt §5.4): overlay gris-900/50,
 * panel blanco con padding 24px, radio 12px y sombra modal.
 * Se cierra con Escape, con la X o pulsando fuera del panel.
 */

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Botones de acción (flex final alineado a la derecha). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId()
  const { t } = useLang()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 p-4 sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('animate-scale-in my-6 w-full rounded-lg bg-white p-6 shadow-modal', SIZES[size])}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-h3 text-gray-900">
            {t(title)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.cerrar')}
            className="-m-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
