import { useEffect, useState } from 'react'
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { subscribe } from './store'

/**
 * Contexto de datos: expone la versión del almacén para que cualquier vista
 * se recalcule sola cuando otro módulo modifica la información.
 */

const DataVersionContext = createContext<number>(0)

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)

  useEffect(() => subscribe(() => setVersion((current) => current + 1)), [])

  return <DataVersionContext.Provider value={version}>{children}</DataVersionContext.Provider>
}

/** Versión del almacén (cambia con cada operación de datos). */
export const useDataVersion = (): number => useContext(DataVersionContext)
