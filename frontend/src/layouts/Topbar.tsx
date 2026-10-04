import { useState } from 'react'
import { useLocation, useNavigation } from 'react-router-dom'
import { Bell, Moon, Search, Sun } from 'lucide-react'
import { PATH_TITLES } from '@/utils/constants'
import { getTheme, toggleTheme, type Theme } from '@/utils/theme'
import ProgressBar from '@/components/ui/ProgressBar'
import { useAuth } from '@/hooks/useAuth'

/**
 * Topbar: 64px de alto, fondo blanco, borde inferior gris 200.
 * Contenido: título/breadcrumbs, búsqueda, notificaciones y avatar (txt §7.1).
 * Lleva la barra de progreso de cargas debajo (txt §5.5).
 */
export default function Topbar() {
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  const title = PATH_TITLES[pathname] ?? 'SalesIA Enterprise'
  const initials =
    (user?.name ?? 'Usuario')
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'US'

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 print:hidden lg:px-8">
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
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          onClick={() => setTheme(toggleTheme())}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
        >
          {theme === 'dark' ? (
            <Sun aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Moon aria-hidden="true" className="h-5 w-5" />
          )}
        </button>

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
            {initials}
          </div>
          <div className="hidden lg:block">
            <p className="text-body-sm font-medium text-gray-700">{user?.name ?? 'Usuario'}</p>
            <p className="text-caption text-gray-400">{user?.role ?? 'Invitado'}</p>
          </div>
        </div>
      </div>

      {/* Barra de progreso de cargas de ruta (txt §5.5) */}
      <ProgressBar active={navigation.state === 'loading'} />
    </header>
  )
}
