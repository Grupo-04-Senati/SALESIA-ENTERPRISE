import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Warehouse,
  TrendingUp,
  Percent,
  Lightbulb,
  FileText,
  Settings,
} from 'lucide-react'

/**
 * Constantes compartidas del frontend.
 * Navegación y títulos según el sistema de diseño (Fase 03)
 * y la estructura de módulos (docs/02_arquitectura.md).
 */

export interface NavItem {
  /** Etiqueta visible en el sidebar */
  label: string
  /** Ruta del módulo */
  path: string
  /** Icono Lucide (20px en el sidebar) */
  icon: LucideIcon
  /** Grupo del sidebar: Operación · Analítica · Sistema */
  group: 'operacion' | 'analitica' | 'sistema'
}

export const NAV_ITEMS: NavItem[] = [
  // --- Operación ---
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'operacion' },
  { label: 'Clientes', path: '/clientes', icon: Users, group: 'operacion' },
  { label: 'Productos', path: '/productos', icon: Package, group: 'operacion' },
  { label: 'Ventas', path: '/ventas', icon: ShoppingCart, group: 'operacion' },
  { label: 'Inventario', path: '/inventario', icon: Warehouse, group: 'operacion' },
  // --- Analítica ---
  { label: 'Analytics', path: '/analytics', icon: TrendingUp, group: 'analitica' },
  { label: 'Probabilidad', path: '/probabilidad', icon: Percent, group: 'analitica' },
  { label: 'Insights', path: '/insights', icon: Lightbulb, group: 'analitica' },
  { label: 'Reportes', path: '/reportes', icon: FileText, group: 'analitica' },
  // --- Sistema ---
  { label: 'Configuración', path: '/configuracion', icon: Settings, group: 'sistema' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  operacion: 'Operación',
  analitica: 'Analítica',
  sistema: 'Sistema',
}

/** Título de la topbar por ruta (txt §7.1) */
export const PATH_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/productos': 'Productos',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/analytics': 'Analytics',
  '/probabilidad': 'Probabilidad',
  '/insights': 'Insights',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
}
