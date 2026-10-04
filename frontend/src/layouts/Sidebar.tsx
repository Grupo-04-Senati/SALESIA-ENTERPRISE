import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutGrid, LogOut } from 'lucide-react'
import { GROUP_LABELS, visibleModules } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'

const GROUPS = ['operacion', 'analitica', 'sistema'] as const

interface SidebarProps {
  /** Cierra el overlay móvil tras navegar. */
  onNavigate?: () => void
}

/**
 * Sidebar (Diseño E · vista 2): muestra solo la sección del módulo
 * activo. El header (etiqueta + contador + chevron) abre un menú para
 * saltar a otra sección o volver al launcher ("Todos los módulos").
 * Item activo con fondo azul translúcido e indicador lateral.
 * Pie con usuario + cerrar sesión.
 */
export default function Sidebar({ onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const items = visibleModules(user?.role)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

  const group =
    items.find((item) => item.path === pathname)?.group ??
    items.find((item) => item.group)?.group ??
    'operacion'
  const groupItems = items.filter((item) => item.group === group)

  useEffect(() => setMenuOpen(false), [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const goToGroup = (target: string) => {
    const first = items.find((item) => item.group === target)
    setMenuOpen(false)
    if (first) navigate(first.path)
    onNavigate?.()
  }

  return (
    <aside
      ref={rootRef}
      className="relative flex h-screen w-[250px] flex-col bg-[#1E3A8A] text-white print:hidden"
    >
      {/* Navegación: solo la sección activa */}
      <nav className="flex flex-1 flex-col justify-between overflow-y-auto px-2.5 py-2.5">
        <div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-white transition-colors hover:bg-white/5"
            >
              <span className="flex-1 text-left">{GROUP_LABELS[group]}</span>
              <span className="rounded-full bg-white/10 px-2 py-px text-[10px] tabular-nums text-white/75">
                {groupItems.length}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-3.5 w-3.5 text-white/70 transition-transform duration-200 ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute left-2.5 top-11 z-40 w-[226px] rounded-xl border border-white/15 bg-[#152A66] p-1.5 shadow-[0_18px_36px_rgba(0,0,0,0.4)]"
              >
                {GROUPS.map((other) => {
                  const count = items.filter((item) => item.group === other).length
                  if (count === 0) return null
                  const current = other === group
                  return (
                    <button
                      key={other}
                      type="button"
                      role="menuitem"
                      aria-current={current ? 'true' : undefined}
                      onClick={() => (current ? setMenuOpen(false) : goToGroup(other))}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors hover:bg-white/10 hover:text-white ${
                        current ? 'bg-white/10 font-medium text-white' : 'text-white/85'
                      }`}
                    >
                      <span className="flex-1 text-left">{GROUP_LABELS[other]}</span>
                      <span
                        className={`rounded-full px-2 py-px text-[10px] tabular-nums ${
                          current ? 'bg-primary text-white' : 'bg-white/15 text-white/75'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
                <div className="my-1 h-px bg-white/15" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/')
                    onNavigate?.()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LayoutGrid aria-hidden="true" className="h-4 w-4" />
                  <span className="text-left">Todos los módulos</span>
                </button>
              </div>
            )}
          </div>

          <ul className="mt-1.5">
            {groupItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
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
