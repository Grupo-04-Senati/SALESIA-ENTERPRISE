import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { PATH_TITLES } from '@/utils/constants'

/**
 * Topbar: 64px de alto, fondo blanco, borde inferior gris 200.
 * Contenido: título/breadcrumbs, búsqueda, notificaciones y avatar (txt §7.1).
 */
export default function Topbar() {
  const { pathname } = useLocation()
  const title = PATH_TITLES[pathname] ?? 'SalesIA Enterprise'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 lg:px-8">
      {/* Título de la página */}
      <div className="flex items-center gap-2 text-body-sm text-gray-500">
        <span>SalesIA</span>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-gray-900">{title}</span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Buscar…"
            aria-label="Buscar en el sistema"
            className="input h-9 w-56 py-1.5 pl-9 text-body-sm"
          />
        </div>

        <button
          type="button"
          aria-label="Notificaciones"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-body-sm font-semibold text-white"
          >
            US
          </div>
          <span className="hidden text-body-sm font-medium text-gray-700 lg:block">
            Usuario
          </span>
        </div>
      </div>
    </header>
  )
}
