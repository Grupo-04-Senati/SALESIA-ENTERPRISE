import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * i18n ligero para el shell (topbar, sidebar, launcher y login).
 * Persiste la preferencia en localStorage y alterna con el botón
 * de idioma de la topbar. Los módulos internos quedan en español.
 */

export type Lang = 'es' | 'en'
type Dict = Record<string, string>

const STORAGE_KEY = 'salesia-lang'

const ES: Dict = {
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

const EN: Dict = {
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
  /** Traduce una clave; `{n}` se reemplaza por params.n. */
  t: (key: string, params?: { n?: number }) => string
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
    (key: string, params?: { n?: number }) => {
      const raw = DICTS[lang][key] ?? DICTS.es[key] ?? key
      return params?.n === undefined ? raw : raw.replace('{n}', String(params.n))
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
