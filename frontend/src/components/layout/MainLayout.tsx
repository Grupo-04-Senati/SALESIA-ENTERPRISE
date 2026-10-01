import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import HotZone from './HotZone'
import Sidebar from './Sidebar'
import Topbar from '@/layouts/Topbar'

/** Delay de cierre para evitar parpadeos si el cursor pasa rápido (txt). */
const CLOSE_DELAY_MS = 250

/**
 * Layout principal autenticado con sidebar auto-hide (txt de hover):
 *
 * - Hot zone: div fijo de 12px en el borde izquierdo (z-40, sin fondo).
 *   onMouseEnter -> abre el sidebar de inmediato.
 * - Sidebar: fixed z-50 con transform; al salir del mismo (onMouseLeave)
 *   se programa el cierre a los 250ms. Reentrar durante ese delay cancela
 *   el temporizador, así el sidebar nunca se "pega" ni parpadea.
 * - El contenido principal NO tiene margin-left: ocupa todo el ancho
 *   siempre; el sidebar flota por encima con z-index alto.
 * - Al montar: sidebar oculto (translateX(-100%)).
 */
export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const openSidebar = () => {
    clearCloseTimer()
    setSidebarOpen(true)
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setSidebarOpen(false)
    }, CLOSE_DELAY_MS)
  }

  // Limpieza al desmontar: nunca queda un timer de cierre huérfano.
  useEffect(() => clearCloseTimer, [])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HotZone onEnter={openSidebar} />
      <Sidebar open={sidebarOpen} onOpen={openSidebar} onClose={scheduleClose} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
