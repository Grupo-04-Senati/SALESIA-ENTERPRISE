import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NAV_ITEMS, GROUP_LABELS } from '@/utils/constants'

interface SidebarProps {
  /** Estado colapsado (64px) vs expandido (240px) — txt §7.1 */
  collapsed: boolean
  onToggle: () => void
}

const GROUPS = ['operacion', 'analitica', 'sistema'] as const

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 flex h-screen flex-col bg-primary text-white transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo (48px de alto) */}
      <div className="flex h-16 items-center justify-center border-b border-white/10 px-3">
        <img
          src="/logo.jpg"
          alt="Logo de SalesIA Enterprise"
          className="h-12 w-12 rounded-full object-cover"
        />
        {!collapsed && (
          <span className="ml-3 truncate text-body-sm font-semibold text-white">
            SalesIA Enterprise
          </span>
        )}
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-3 text-caption font-semibold uppercase tracking-wider text-white/50">
                {GROUP_LABELS[group]}
              </p>
            )}
            <ul className="space-y-1">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'text-white/90 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Colapsar / expandir */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="flex items-center justify-center border-t border-white/10 py-3 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        {collapsed ? (
          <ChevronsRight aria-hidden="true" className="h-5 w-5" />
        ) : (
          <ChevronsLeft aria-hidden="true" className="h-5 w-5" />
        )}
      </button>
    </aside>
  )
}
