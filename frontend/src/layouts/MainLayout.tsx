import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { NAV_ITEMS } from '@/utils/constants'

const PIN_KEY = 'salesia-sidebar-pinned'

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Layout principal (Diseño E):
 * la barra lateral del escritorio está oculta por defecto (el contenido
 * usa todo el ancho) y se despliega al pasar el cursor por el borde
 * izquierdo; se cierra al retirar el cursor. El botón del menú la
 * ancla/desancla (se guarda la preferencia). En móvil, overlay con
 * hamburguesa como siempre.
 */
export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pinned, setPinned] = useState<boolean>(readPinned)
  const [hoverOpen, setHoverOpen] = useState(false)
  const location = useLocation()
  const currentModule = NAV_ITEMS.find((item) => item.path === location.pathname)

  useEffect(() => {
    try {
      localStorage.setItem(PIN_KEY, pinned ? '1' : '0')
    } catch {
      // Preferencia efímera sin storage.
    }
  }, [pinned])

  const isDesktop = () =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  const handleMenu = () => {
    if (isDesktop()) {
      setPinned((value) => !value)
      setHoverOpen(false)
    } else {
      setMobileOpen(true)
    }
  }

  const desktopOpen = pinned || hoverOpen
  const closeDesktop = () => {
    if (!pinned) setHoverOpen(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Barra lateral escritorio: fuera del flujo (el contenido usa todo
          el ancho). Contenedor único = tira de hover (retraída) + barra
          desplegable; así el mouseleave se dispara siempre al retirar el
          cursor, incluso si la barra se abre justo bajo él. */}
      <div
        className={`fixed bottom-0 left-0 top-14 z-40 hidden w-6 overflow-hidden shadow-large transition-[width] duration-200 ease-out lg:block ${
          desktopOpen ? 'w-[250px]' : 'w-6'
        }`}
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={closeDesktop}
      >
        {/* Asa indicadora cuando está retraída */}
        {!desktopOpen && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-16 w-6 -translate-y-1/2 rounded-r-full bg-primary/30"
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 w-[250px] transition-transform duration-200 ease-out ${
            desktopOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onNavigate={closeDesktop} />
        </div>
      </div>

      {/* Sidebar móvil (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-large">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={handleMenu} />
        <main className="flex-1 px-5 py-6 lg:px-7">
          <div className="mx-auto w-full max-w-[1600px]">
            {/* Banner superior con la imagen del módulo activo */}
            {currentModule && (
              <div key={location.pathname} className="mod-hero">
                <img
                  src={currentModule.img}
                  alt=""
                  aria-hidden="true"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
                <span className="mod-hero-ico">
                  <currentModule.icon aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
            )}
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
