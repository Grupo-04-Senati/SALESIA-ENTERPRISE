import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { startArabic, stopArabic } from './arabic'

const ARMED_KEY = 'salesia-prank-armed'

const ACTIVE_KEY = 'salesia-prank-active'

export interface PrankValue {
  armed: boolean
  active: boolean
  setArmed: (value: boolean) => void
  setActive: (value: boolean) => void
}

const PrankContext = createContext<PrankValue | null>(null)

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  const store = storage()
  if (store === null) return fallback
  const raw = store.getItem(key)
  return raw === null ? fallback : raw === '1'
}

function writeFlag(key: string, value: boolean): void {
  storage()?.setItem(key, value ? '1' : '0')
}

interface PrankProviderProps {
  children: ReactNode
  defaultArmed?: boolean
}

export function PrankProvider({ children, defaultArmed = false }: PrankProviderProps) {
  const [armed, setArmedState] = useState(() => readFlag(ARMED_KEY, defaultArmed))
  const [active, setActiveState] = useState(() => readFlag(ACTIVE_KEY, false))

  useEffect(() => {
    writeFlag(ARMED_KEY, armed)
  }, [armed])

  useEffect(() => {
    writeFlag(ACTIVE_KEY, active)
  }, [active])

  useEffect(() => {
    if (active) startArabic()
    else stopArabic()
    return () => stopArabic()
  }, [active])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'a') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      const typing =
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (active) {
        event.preventDefault()
        setActiveState(false)
        return
      }
      if (!armed || typing) return
      event.preventDefault()
      setActiveState(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [armed, active])

  const value = useMemo<PrankValue>(
    () => ({
      armed,
      active,
      setArmed: (next: boolean) => {
        setArmedState(next)
        if (!next) setActiveState(false)
      },
      setActive: setActiveState,
    }),
    [armed, active],
  )

  return <PrankContext.Provider value={value}>{children}</PrankContext.Provider>
}

export function usePrank(): PrankValue {
  const context = useContext(PrankContext)
  if (context === null) throw new Error('usePrank debe usarse dentro de PrankProvider')
  return context
}
