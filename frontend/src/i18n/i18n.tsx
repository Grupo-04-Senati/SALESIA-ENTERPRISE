import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { dictCommon } from './dict/common'
import { dictDashboard } from './dict/dashboard'
import { dictCustomers } from './dict/customers'
import { dictProducts } from './dict/products'
import { dictCategories } from './dict/categories'
import { dictInventory } from './dict/inventory'
import { dictSales } from './dict/sales'
import { dictReturns } from './dict/returns'
import { dictPurchasing } from './dict/purchasing'
import { dictQuotes } from './dict/quotes'
import { dictPricing } from './dict/pricing'
import { dictReports } from './dict/reports'
import { dictInsights } from './dict/insights'
import { dictProbability } from './dict/probability'
import { dictAutomation } from './dict/automation'
import { dictSettings } from './dict/settings'
import { dictEmployees } from './dict/employees'
import { dictAnalytics } from './dict/analytics'

/**
 * i18n ligero de toda la app: shell (topbar, sidebar, launcher, login) y
 * módulos internos (diccionarios en ./dict/*). Persiste la preferencia en
 * localStorage y alterna con el botón de idioma de la topbar.
 */

export type Lang = 'es' | 'en'
export type Dict = Record<string, string>
export type ModuleDict = { es: Dict; en: Dict }

const STORAGE_KEY = 'salesia-lang'

const baseES: Dict = {
  'topbar.searchModules': 'Buscar módulo…',
  'topbar.searchSystem': 'Buscar en el sistema…',
  'topbar.searchLabel': 'Buscar',
  'topbar.back': 'Módulos',
  'topbar.notifications': 'Notificaciones',
  'topbar.lang': 'Cambiar a inglés',
  'topbar.themeDark': 'Modo oscuro',
  'topbar.themeLight': 'Modo claro',
  'launcher.greet': 'Hola',
  'launcher.lead':
    'Elige un módulo para empezar. Al entrar verás tu barra lateral con todo lo que te corresponde.',
  'launcher.kpiMonth': 'Ventas del mes',
  'launcher.kpiIncome': 'Ingresos 12 m',
  'launcher.kpiClients': 'Clientes',
  'launcher.modules': '{n} módulo(s)',
  'launcher.emptyTitle': 'Sin módulos que coincidan',
  'launcher.emptyBody': 'Prueba con otro término o cambia de rol abajo.',
  'sidebar.logout': 'Cerrar sesión',
  'sidebar.guest': 'Invitado',
  'notif.title': 'Notificaciones',
  'notif.empty': 'No tienes notificaciones.',
  'notif.loading': 'Cargando notificaciones…',
  'notif.markAll': 'Marcar todas como leídas',
  'login.welcome': 'Bienvenido de nuevo',
  'login.sub': 'Ingresa tus credenciales para continuar.',
  'login.email': 'Correo electrónico',
  'login.password': 'Contraseña',
  'login.submit': 'Iniciar sesión',
  'login.submitting': 'Ingresando…',
  'login.error': 'No se pudo iniciar sesión.',
  'login.hint': 'Acceso de administrador:',
  'login.passwordLabel': 'Contraseña:',
  'login.forgot': '¿Olvidaste tu contraseña? Contacta al administrador del sistema.',
  'auth.brandSub': 'Sistema de Gestión y Analítica',
  'auth.headline': 'Gestiona tu operación con datos claros y decisiones rápidas.',
  'auth.lead': 'Ventas, inventario, clientes y analítica estadística en un solo lugar.',
  'auth.hl1': 'Analítica de ventas en tiempo real',
  'auth.hl2': 'Gestión por roles y accesos seguros',
  'auth.hl3': 'Automatizaciones y reportes automáticos',
}

const baseEN: Dict = {
  'topbar.searchModules': 'Search module…',
  'topbar.searchSystem': 'Search the system…',
  'topbar.searchLabel': 'Search',
  'topbar.back': 'Modules',
  'topbar.notifications': 'Notifications',
  'topbar.lang': 'Switch to Spanish',
  'topbar.themeDark': 'Dark mode',
  'topbar.themeLight': 'Light mode',
  'launcher.greet': 'Hello',
  'launcher.lead': 'Pick a module to get started. Inside, your sidebar shows everything assigned to you.',
  'launcher.kpiMonth': 'Sales this month',
  'launcher.kpiIncome': 'Revenue 12 mo',
  'launcher.kpiClients': 'Customers',
  'launcher.modules': '{n} module(s)',
  'launcher.emptyTitle': 'No matching modules',
  'launcher.emptyBody': 'Try another term or switch the role below.',
  'sidebar.logout': 'Sign out',
  'sidebar.guest': 'Guest',
  'notif.title': 'Notifications',
  'notif.empty': 'You have no notifications.',
  'notif.loading': 'Loading notifications…',
  'notif.markAll': 'Mark all as read',
  'login.welcome': 'Welcome back',
  'login.sub': 'Enter your credentials to continue.',
  'login.email': 'Email address',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.error': 'Could not sign in.',
  'login.hint': 'Admin access:',
  'login.passwordLabel': 'Password:',
  'login.forgot': 'Forgot your password? Contact the system administrator.',
  'auth.brandSub': 'Management & Analytics System',
  'auth.headline': 'Run your operation with clear data and fast decisions.',
  'auth.lead': 'Sales, inventory, customers and statistical analytics in one place.',
  'auth.hl1': 'Real-time sales analytics',
  'auth.hl2': 'Role-based access and secure management',
  'auth.hl3': 'Automations and scheduled reports',
}

const MODULE_DICTS: ModuleDict[] = [
  dictCommon,
  dictDashboard,
  dictCustomers,
  dictProducts,
  dictCategories,
  dictInventory,
  dictSales,
  dictReturns,
  dictPurchasing,
  dictQuotes,
  dictPricing,
  dictReports,
  dictInsights,
  dictProbability,
  dictAutomation,
  dictSettings,
  dictEmployees,
  dictAnalytics,
]

const ES: Dict = Object.assign({}, baseES, ...MODULE_DICTS.map((dict) => dict.es))
const EN: Dict = Object.assign({}, baseEN, ...MODULE_DICTS.map((dict) => dict.en))

const DICTS: Record<Lang, Dict> = { es: ES, en: EN }

/** Etiquetas de roles según idioma. */
export const ROLE_LABELS: Record<Lang, Record<string, string>> = {
  es: { Admin: 'Admin', Gerente: 'Gerente', Vendedor: 'Vendedor', Analista: 'Analista', Almacén: 'Almacén' },
  en: { Admin: 'Admin', Gerente: 'Manager', Vendedor: 'Seller', Analista: 'Analyst', Almacén: 'Warehouse' },
}

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  /** Traduce una clave; los `{placeholder}` se reemplazan por params. */
  t: (key: string, params?: Record<string, string | number>) => string
}

const LangContext = createContext<LangContextValue | null>(null)

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
  } catch {
    // localStorage no disponible → español.
  }
  return 'es'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Preferencia efímera si no hay storage.
    }
  }, [lang])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const raw = DICTS[lang][key] ?? DICTS.es[key] ?? key
      if (!params) return raw
      return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
        params[name] !== undefined ? String(params[name]) : whole,
      )
    },
    [lang],
  )

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      toggleLang: () => setLangState((current) => (current === 'es' ? 'en' : 'es')),
      t,
    }),
    [lang, t],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) throw new Error('useLang debe usarse dentro de LangProvider')
  return context
}
