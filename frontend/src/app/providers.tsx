import type { ReactNode } from 'react'
import { DataProvider } from '@/data/DataProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { LangProvider } from '@/i18n/i18n'
import { PrankProvider } from '@/prank/PrankContext'
import PrankOverlay from '@/prank/PrankOverlay'

/**
 * Proveedor global de la aplicación.
 * Encadena los contextos transversales: idioma del shell (LangProvider),
 * datos compartidos entre módulos (DataProvider) y avisos (ToastProvider).
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <PrankProvider>
        <DataProvider>
          <ToastProvider>
            {children}
            <PrankOverlay />
          </ToastProvider>
        </DataProvider>
      </PrankProvider>
    </LangProvider>
  )
}
