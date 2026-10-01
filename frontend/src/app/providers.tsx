import type { ReactNode } from 'react'
import { DataProvider } from '@/data/DataProvider'
import { ToastProvider } from '@/components/ui/Toast'

/**
 * Proveedor global de la aplicación.
 * Encadena los contextos transversales: datos compartidos entre módulos
 * (DataProvider) y avisos (ToastProvider).
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <ToastProvider>{children}</ToastProvider>
    </DataProvider>
  )
}
