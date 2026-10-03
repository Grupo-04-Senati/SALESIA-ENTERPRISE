import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { NAV_ITEMS, GROUP_LABELS } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  /** true = visible (translateX(0)); false = oculto (translateX(-100%)). */
  open: boolean
  /** El cursor entró: cancela el cierre pendiente y muestra el sidebar. */
  onOpen: () => void
  /** El cursor salió: programa el cierre con delay (250ms) en MainLayout. */
  onClose: () => void
}

const GROUPS = ['operacion', 'analitica', 'sistema'] as const

/**
 * Sidebar auto-hide / hover-expand (txt de hover):
 * fixed left-0 top-0 h-full w-60 z-50 con transition-transform duration-300
 * ease-in-out; translateX(-100%) oculto y translateX(0) visible. Flota por
 * encima del contenido (el contenido NO se desplaza). Mantiene el diseño del
 * sistema: fondo #1E3A8A, grupos OPERACIÓN / ANALÍTICA / SISTEMA y item
 * activo en cyan #06B6D4.
 */
export default function Sidebar({ open, onOpen, onClose }: SidebarProps) {
  const { logout } = useAuth()

  const handleLogout = () => {
    // TODO(Fase 05): la sesión real usa el token de /api/v1/auth/logout.
    logout()
  }

  return (
    <aside
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      className={`fixed left-0 top-0 z-50 flex h-full w-60 flex-col bg-primary text-white transition-transform duration-300 ease-in-out print:hidden ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo (48px de alto) */}
      <div className="flex h-16 items-center justify-center border-b border-white/10 px-3">
        <img
          src="/logo.jpg"
          alt="Logo de SalesIA Enterprise"
          className="h-12 w-12 rounded-full object-cover"
        />
        <span className="ml-3 truncate text-body-sm font-semibold text-white">
          SalesIA Enterprise
        </span>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group} className="mb-4">
            <p className="mb-1 px-3 text-caption font-semibold uppercase tracking-wider text-white/50">
              {GROUP_LABELS[group]}
            </p>
            <ul className="space-y-1">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'text-white/90 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Cerrar sesión */}
      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center gap-3 border-t border-white/10 px-5 py-3 text-body-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  )
}
