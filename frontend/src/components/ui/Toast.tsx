import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLang } from '@/i18n/i18n'

/**
 * Toasts del sistema de diseño (txt §5.5): fondo blanco, radio 8px,
 * borde izquierdo de 4px con el color del tipo, sombra y auto-cierre
 * a los 4 segundos. Se anclan abajo a la derecha.
 */

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  message?: string
}

export interface ToastApi {
  show: (variant: ToastVariant, title: string, message?: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  dismiss: (id: number) => void
}

type ToastIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

const STYLES: Record<ToastVariant, { style: string; icon: ToastIcon }> = {
  success: { style: 'border-success bg-success-bg text-success-fg', icon: CheckCircle2 },
  error: { style: 'border-error bg-error-bg text-error-fg', icon: XCircle },
  warning: { style: 'border-warning bg-warning-bg text-warning-fg', icon: AlertTriangle },
  info: { style: 'border-info bg-info-bg text-info-fg', icon: Info },
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_DISMISS_MS = 4000
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = ++nextId.current
      setToasts((previous) => [...previous.slice(-(MAX_VISIBLE - 1)), { id, variant, title, message }])
      timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS))
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, message) => show('success', title, message),
      error: (title, message) => show('error', title, message),
      info: (title, message) => show('info', title, message),
      warning: (title, message) => show('warning', title, message),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3"
      >
        {toasts.map((toast) => {
          const { style, icon: Icon } = STYLES[toast.variant]
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'animate-float-in-right pointer-events-auto rounded-md border p-4 shadow-medium',
                style,
              )}
            >
              <div className="flex items-start gap-3">
                <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{toast.title}</p>
                  {toast.message && <p className="mt-0.5 text-caption">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label={t('common.cerrar-aviso')}
                  className="-m-0.5 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/** Hook para disparar toasts desde cualquier página. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>')
  }
  return context
}
