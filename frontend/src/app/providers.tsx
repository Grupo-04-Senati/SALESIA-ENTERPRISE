import type { ReactNode } from 'react'

/**
 * Proveedor global de la aplicación.
 * Punto de extensión para contextos transversales (auth, tema, toasts…)
 * que se añadirán en fases posteriores.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
