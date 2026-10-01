import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'

/**
 * Proveedor global de la aplicación.
 * Encadena los contextos transversales: toasts (txt §5.5) y,
 * más adelante, autenticación (Fase 05).
 */
export default function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
