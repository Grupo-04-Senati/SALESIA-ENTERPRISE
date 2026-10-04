import type { ReactNode } from 'react'
import { DataProvider } from '@/data/DataProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { LangProvider } from '@/i18n/i18n'

/**
 * Proveedor global de la aplicación.
 * Encadena los contextos transversales: idioma del shell (LangProvider),
 * datos compartidos entre módulos (DataProvider) y avisos (ToastProvider).
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <DataProvider>
        <ToastProvider>{children}</ToastProvider>
      </DataProvider>
    </LangProvider>
  )
}
