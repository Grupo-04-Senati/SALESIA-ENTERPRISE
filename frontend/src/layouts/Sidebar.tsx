import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import { GROUP_LABELS, visibleModules } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'

const GROUPS = ['operacion', 'analitica', 'sistema'] as const

interface SidebarProps {
  /** Cierra el overlay móvil tras navegar. */
  onNavigate?: () => void
}

/**
 * Sidebar (Diseño E): fijo, ancho 250px, fondo navy.
 * Secciones colapsables (acordeón): se abre la del módulo activo;
 * el header muestra contador y chevron. Item activo con fondo azul
 * translúcido e indicador lateral claro. Pie con usuario + salir.
 */
export default function Sidebar({ onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const items = visibleModules(user?.role)

  // null = seguir el grupo de la ruta activa; '__none__' = todo colapsado.
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null)

  const activeGroup =
    items.find((item) => item.path === pathname)?.group ??
    items.find((item) => item.group)?.group ??
    'operacion'

  useEffect(() => {
    setExpandedOverride(null)
  }, [pathname])

  const openGroup = expandedOverride ?? activeGroup

  const toggleGroup = (group: string) => {
    setExpandedOverride(openGroup === group ? '__none__' : group)
  }

  return (
    <aside className="flex h-screen w-[250px] flex-col bg-[#1E3A8A] text-white print:hidden">
      {/* Navegación */}
      <nav className="flex flex-1 flex-col justify-between overflow-y-auto px-2.5 py-2.5">
        <div>
          {GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group)
            if (groupItems.length === 0) return null
            const isOpen = openGroup === group

            return (
              <div key={group} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors ${
                    isOpen ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span className="flex-1 text-left">{GROUP_LABELS[group]}</span>
                  <span className="rounded-full bg-white/10 px-2 py-px text-[10px] tabular-nums text-white/75">
                    {groupItems.length}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isOpen ? '' : '-rotate-90'
                    }`}
                  />
                </button>

                {isOpen && (
                  <ul className="mb-2">
                    {groupItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.path}>
                          <NavLink
                            to={item.path}
                            end={item.path === '/'}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              `relative my-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] transition-colors ${
                                isActive
                                  ? 'bg-[rgba(9,57,230,0.38)] font-medium text-white'
                                  : 'text-white/85 hover:bg-white/10 hover:text-white'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#8FB0FF]"
                                  />
                                )}
                                <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {/* Usuario + salir */}
        <div className="-mx-2.5 mt-2 border-t border-white/10 bg-black/20 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#1E3A8A]"
            >
              {(user?.name ?? 'Usuario')
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? '')
                .join('') || 'US'}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{user?.name ?? 'Usuario'}</p>
              <p className="truncate text-[11px] text-white/55">{user?.role ?? 'Invitado'}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-primary hover:text-white"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>
    </aside>
  )
}
