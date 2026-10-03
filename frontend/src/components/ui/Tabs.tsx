import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/**
 * Tabs (txt §5): pestañas en fila con borde inferior; la activa usa
 * texto azul corporativo y subrayado de 2px.
 */

export interface TabItem {
  id: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  /** id accesible base (para aria-controls). */
  id?: string
}

export default function Tabs({ items, value, onChange, id = 'tabs' }: TabsProps) {
  return (
    <div role="tablist" aria-label="Secciones" className="flex flex-wrap gap-1 border-b border-gray-200">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-${item.id}`}
            aria-selected={active}
            aria-controls={`${id}-panel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-body-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  tabId: string
  active: boolean
  children: ReactNode
}

/** Panel asociado a un tab (se muestra solo si está activo). */
export function TabPanel({ tabId, active, children }: TabPanelProps) {
  if (!active) return null
  return (
    <div role="tabpanel" id={`tabs-panel-${tabId}`} aria-labelledby={`tabs-${tabId}`} tabIndex={0}>
      {children}
    </div>
  )
}
