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
  UserPlus,
  Zap,
  Truck,
  ClipboardList,
  RotateCcw,
  Coins,
} from 'lucide-react'

/**
 * Constantes compartidas del frontend.
 * Navegación y títulos según el sistema de diseño (Fase 03)
 * y la estructura de módulos (docs/02_arquitectura.md).
 */

export interface NavItem {
  /** Etiqueta visible en el sidebar */
  label: string
  /** Etiqueta en inglés (shell i18n) */
  labelEn: string
  /** Descripción corta (cards del launcher) */
  desc: string
  /** Descripción en inglés */
  descEn: string
  /** Ruta del módulo */
  path: string
  /** Icono Lucide (20px en el sidebar) */
  icon: LucideIcon
  /** Imagen de la card en el launcher (public/cards) */
  img: string
  /** Grupo del sidebar: Operación · Analítica · Sistema */
  group: 'operacion' | 'analitica' | 'sistema'
}

export const NAV_ITEMS: NavItem[] = [
  // --- Operación ---
  { label: 'Dashboard', labelEn: 'Dashboard', desc: 'Resumen general del negocio', descEn: 'Overall business overview', path: '/dashboard', icon: LayoutDashboard, img: '/cards/dashboard.jpg', group: 'operacion' },
  { label: 'Ventas', labelEn: 'Sales', desc: 'Órdenes, tickets y facturación', descEn: 'Orders, tickets and invoicing', path: '/ventas', icon: ShoppingCart, img: '/cards/ventas.jpeg', group: 'operacion' },
  { label: 'Inventario', labelEn: 'Inventory', desc: 'Stock, kardex y conteos', descEn: 'Stock, ledgers and counts', path: '/inventario', icon: Warehouse, img: '/cards/inventario.jpg', group: 'operacion' },
  { label: 'Clientes', labelEn: 'Customers', desc: 'Cartera, segmentos e interacciones', descEn: 'Portfolio, segments and interactions', path: '/clientes', icon: Users, img: '/cards/clientes.jpg', group: 'operacion' },
  { label: 'Catálogo', labelEn: 'Catalog', desc: 'Productos, categorías y unidades', descEn: 'Products, categories and units', path: '/productos', icon: Package, img: '/cards/productos.jpg', group: 'operacion' },
  { label: 'Vendedores', labelEn: 'Sellers', desc: 'Equipo y metas de venta', descEn: 'Team and sales targets', path: '/vendedores', icon: UserPlus, img: '/cards/vendedores.jpg', group: 'operacion' },
  { label: 'Compras', labelEn: 'Purchasing', desc: 'Órdenes de compra y proveedores', descEn: 'Purchase orders and suppliers', path: '/compras', icon: Truck, img: '/cards/compras.jpg', group: 'operacion' },
  { label: 'Cotizaciones', labelEn: 'Quotes', desc: 'Propuestas y conversión a venta', descEn: 'Proposals and conversion to sale', path: '/cotizaciones', icon: ClipboardList, img: '/cards/cotizaciones.jpg', group: 'operacion' },
  { label: 'Devoluciones', labelEn: 'Returns', desc: 'Reembolsos y reposición', descEn: 'Refunds and restocking', path: '/devoluciones', icon: RotateCcw, img: '/cards/devoluciones.jpg', group: 'operacion' },
  { label: 'Precios', labelEn: 'Pricing', desc: 'Listas, descuentos y promociones', descEn: 'Lists, discounts and promotions', path: '/precios', icon: Coins, img: '/cards/precios.jpg', group: 'operacion' },
  // --- Analítica ---
  { label: 'Analytics', labelEn: 'Analytics', desc: 'KPIs, series y comparativas', descEn: 'KPIs, series and comparisons', path: '/analytics', icon: TrendingUp, img: '/cards/analitics.jpg', group: 'analitica' },
  { label: 'Probabilidad', labelEn: 'Probability', desc: 'Pronóstico de cierre de ventas', descEn: 'Sales closing forecast', path: '/probabilidad', icon: Percent, img: '/cards/probabilidad.jpg', group: 'analitica' },
  { label: 'Insights', labelEn: 'Insights', desc: 'Hallazgos automáticos de datos', descEn: 'Automatic data findings', path: '/insights', icon: Lightbulb, img: '/cards/insights.jpg', group: 'analitica' },
  { label: 'Reportes', labelEn: 'Reports', desc: 'Informes programados y exportación', descEn: 'Scheduled reports and exports', path: '/reportes', icon: FileText, img: '/cards/reportes.jpg', group: 'analitica' },
  // --- Sistema ---
  { label: 'Configuración', labelEn: 'Settings', desc: 'Parámetros, usuarios y roles', descEn: 'Parameters, users and roles', path: '/configuracion', icon: Settings, img: '/cards/configuracion.jpg', group: 'sistema' },
  { label: 'Automatizaciones', labelEn: 'Automations', desc: 'Reglas, alertas y reportes automáticos', descEn: 'Rules, alerts and scheduled reports', path: '/automatizaciones', icon: Zap, img: '/cards/automatizacion.jpg', group: 'sistema' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  operacion: 'Operación',
  analitica: 'Analítica',
  sistema: 'Sistema',
}

/** Etiquetas de grupo en inglés (shell i18n). */
export const GROUP_LABELS_EN: Record<NavItem['group'], string> = {
  operacion: 'Operations',
  analitica: 'Analytics',
  sistema: 'System',
}

/** Todos los módulos (sin filtrar). */
export const ALL_MODULES = '*'

/**
 * Módulos por defecto de cada rol: se usan como fallback mientras el rol no
 * tenga matriz guardada en el backend (Role.permissions). La fuente de verdad
 * en runtime es `user.modules`, que llega de GET /auth/me y editable en
 * Configuración → Roles (PUT /roles/{id}/permissions).
 */
export const ROLE_MODULES: Record<string, string[] | typeof ALL_MODULES> = {
  Admin: ALL_MODULES,
  Gerente: ALL_MODULES,
  Vendedor: ['/dashboard', '/ventas', '/clientes', '/cotizaciones', '/devoluciones', '/productos', '/precios', '/configuracion'],
  Analista: ['/dashboard', '/analytics', '/probabilidad', '/insights', '/reportes', '/clientes', '/productos', '/configuracion'],
  Almacén: ['/dashboard', '/inventario', '/compras', '/productos', '/configuracion'],
}

/**
 * Submódulos por defecto de cada rol (fallback sin matriz guardada).
 * Todos pueden abrir Configuración, pero los que no son Admin/Gerente solo
 * ven «Mi perfil» hasta que el Admin les amplíe la matriz en Roles.
 */
export const ROLE_SUBMODULES: Record<string, Record<string, string[]>> = {
  Vendedor: { '/configuracion': ['perfil'] },
  Analista: { '/configuracion': ['perfil'] },
  Almacén: { '/configuracion': ['perfil'] },
}

/** Submódulos (pestañas/paneles) filtrables por módulo — espejo de core/permissions.py. */
export interface SubmoduleDef {
  id: string
  label: string
  labelEn: string
}

export const MODULE_SUBMODULES: Record<string, SubmoduleDef[]> = {
  '/inventario': [
    { id: 'existencias', label: 'Existencias', labelEn: 'Stock' },
    { id: 'movimientos', label: 'Movimientos', labelEn: 'Movements' },
    { id: 'conteos', label: 'Conteos', labelEn: 'Counts' },
    { id: 'almacenes', label: 'Almacenes', labelEn: 'Warehouses' },
    { id: 'sucursales', label: 'Sucursales', labelEn: 'Branches' },
  ],
  '/productos': [
    { id: 'productos', label: 'Productos', labelEn: 'Products' },
    { id: 'categorias', label: 'Categorías', labelEn: 'Categories' },
    { id: 'unidades', label: 'Unidades', labelEn: 'Units' },
  ],
  '/configuracion': [
    { id: 'perfil', label: 'Perfil', labelEn: 'Profile' },
    { id: 'parametros', label: 'Parámetros', labelEn: 'Parameters' },
    { id: 'usuarios', label: 'Usuarios', labelEn: 'Users' },
    { id: 'roles', label: 'Roles', labelEn: 'Roles' },
    { id: 'sistema', label: 'Sistema', labelEn: 'System' },
    { id: 'notificaciones', label: 'Notificaciones', labelEn: 'Notifications' },
    { id: 'exportaciones', label: 'Exportaciones', labelEn: 'Exports' },
    { id: 'reportes', label: 'Reportes', labelEn: 'Reports' },
  ],
}

/** Lo mínimo que necesitan las funciones de acceso: rol + matriz del backend. */
export interface AccessScope {
  role?: string
  modules?: string[] | null
  submodules?: Record<string, string[]> | null
}

/**
 * Módulos efectivos del usuario: la matriz dinámica del backend si existe;
 * si no, los defaults por nombre de rol. Rol desconocido → todo (evita
 * bloquear cuentas nuevas).
 */
export function resolveModules(scope: AccessScope | null | undefined): string[] | typeof ALL_MODULES {
  if (!scope) return ALL_MODULES
  if (Array.isArray(scope.modules)) return scope.modules
  const fallback = scope.role ? ROLE_MODULES[scope.role] : undefined
  return fallback ?? ALL_MODULES
}

/** ¿Puede ver este módulo? Acepta el usuario completo o solo el nombre del rol. */
export function canAccessModule(
  scope: AccessScope | string | undefined | null,
  path: string,
): boolean {
  const normalized: AccessScope | undefined =
    typeof scope === 'string' ? { role: scope } : scope ?? undefined
  const modules = resolveModules(normalized)
  if (modules === ALL_MODULES) return true
  return modules.includes(path)
}

/**
 * ¿Puede ver esta pestaña/panel del módulo? Si el rol no tiene submódulos
 * configurados para la ruta, se usa ROLE_SUBMODULES (defaults por rol);
 * si tampoco hay, se permite todo lo que el módulo ya habilita.
 */
export function canSubmodule(
  scope: AccessScope | string | undefined | null,
  path: string,
  submodule: string,
): boolean {
  const normalized: AccessScope | undefined =
    typeof scope === 'string' ? { role: scope } : scope ?? undefined
  const modules = resolveModules(normalized)
  if (modules === ALL_MODULES) return true
  if (!modules.includes(path)) return false
  const subs =
    normalized?.submodules?.[path] ??
    (normalized?.role ? ROLE_SUBMODULES[normalized.role]?.[path] : undefined)
  if (!subs || subs.length === 0) return true
  return subs.includes(submodule)
}

/** Módulos visibles (sidebar + launcher). */
export function visibleModules(scope: AccessScope | string | undefined | null): NavItem[] {
  const normalized: AccessScope | undefined =
    typeof scope === 'string' ? { role: scope } : scope ?? undefined
  const modules = resolveModules(normalized)
  if (modules === ALL_MODULES) return NAV_ITEMS
  return NAV_ITEMS.filter((item) => modules.includes(item.path))
}

/** Título de la topbar por ruta (txt §7.1) */
export const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/productos': 'Catálogo',
  '/vendedores': 'Vendedores',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/analytics': 'Analytics',
  '/probabilidad': 'Probabilidad',
  '/insights': 'Insights',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/automatizaciones': 'Automatizaciones',
  '/compras': 'Compras',
  '/cotizaciones': 'Cotizaciones',
  '/devoluciones': 'Devoluciones',
  '/precios': 'Precios',
}

/** Título de la topbar por ruta en inglés (shell i18n). */
export const PATH_TITLES_EN: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Customers',
  '/productos': 'Catalog',
  '/vendedores': 'Sellers',
  '/ventas': 'Sales',
  '/inventario': 'Inventory',
  '/analytics': 'Analytics',
  '/probabilidad': 'Probability',
  '/insights': 'Insights',
  '/reportes': 'Reports',
  '/configuracion': 'Settings',
  '/automatizaciones': 'Automations',
  '/compras': 'Purchasing',
  '/cotizaciones': 'Quotes',
  '/devoluciones': 'Returns',
  '/precios': 'Pricing',
}
