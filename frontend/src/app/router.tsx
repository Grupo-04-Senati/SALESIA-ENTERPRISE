import { Suspense, lazy, useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, Outlet, useNavigate } from 'react-router-dom'
import type { ComponentType, ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import MainLayout from '@/layouts/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import PlaceholderPage from './PlaceholderPage'
import NotFoundPage from './NotFoundPage'
import LoginPage from '@/modules/auth/pages/LoginPage'
import LauncherPage from '@/modules/launcher/pages/LauncherPage'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import { NAV_ITEMS, canAccessModule } from '@/utils/constants'
import { getToken } from '@/services/api'
import { hydrateStore } from '@/services/hydrate'
import { fetchMe } from '@/modules/auth/services/authService'
import { useAuth } from '@/hooks/useAuth'
import { useLang } from '@/i18n/i18n'

/**
 * Carga perezosa de módulos con recuperación ante despliegues: si un chunk
 * cacheado ya no existe en el servidor (la pestaña sobrevivió a un deploy),
 * recarga la página una sola vez para obtener la versión nueva.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      return await load()
    } catch (error) {
      const clave = 'salesia-reload-chunk'
      const ultimo = Number(sessionStorage.getItem(clave) ?? 0)
      if (Date.now() - ultimo > 60_000) {
        sessionStorage.setItem(clave, String(Date.now()))
        window.location.reload()
      }
      throw error
    }
  })
}

const CustomersPage = lazyPage(() => import('@/modules/customers/pages/CustomersPage'))
const ProductsPage = lazyPage(() => import('@/modules/products/pages/ProductsPage'))
const CategoriesPage = lazyPage(() => import('@/modules/categories/pages/CategoriesPage'))
const EmployeesPage = lazyPage(() => import('@/modules/employees/pages/EmployeesPage'))
const SalesPage = lazyPage(() => import('@/modules/sales/pages/SalesPage'))
const InventoryPage = lazyPage(() => import('@/modules/inventory/pages/InventoryPage'))
const AnalyticsPage = lazyPage(() => import('@/modules/analytics/pages/AnalyticsPage'))
const ProbabilityPage = lazyPage(() => import('@/modules/probability/pages/ProbabilityPage'))
const InsightsPage = lazyPage(() => import('@/modules/insights/pages/InsightsPage'))
const ReportsPage = lazyPage(() => import('@/modules/reports/pages/ReportsPage'))
const SettingsPage = lazyPage(() => import('@/modules/settings/pages/SettingsPage'))
const AutomationPage = lazyPage(() => import('@/modules/automation/pages/AutomationPage'))
const PurchasingPage = lazyPage(() => import('@/modules/purchasing/pages/PurchasingPage'))
const QuotesPage = lazyPage(() => import('@/modules/quotes/pages/QuotesPage'))
const ReturnsPage = lazyPage(() => import('@/modules/returns/pages/ReturnsPage'))
const PricingPage = lazyPage(() => import('@/modules/pricing/pages/PricingPage'))

function PageLoader() {
  const { t } = useLang()
  return (
    <div className="flex min-h-screen items-center justify-center text-body text-gray-500">
      {t('common.cargando-puntos')}
    </div>
  )
}

/**
 * Guarda de sesión: exige token (docs/05 §2.1), valida la sesión contra la
 * API (GET /auth/me) y hidrata el almacén con los datos reales.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const { t } = useLang()

  useEffect(() => {
    if (!getToken()) {
      setReady(true)
      return
    }
    fetchMe().catch(() => {
      // Un 401 ya redirige al login (interceptor de services/api.ts).
    })
    hydrateStore()
      .catch((error: unknown) => console.error('No se pudieron cargar los datos de la API', error))
      .finally(() => setReady(true))
  }, [])

  if (!getToken()) return <Navigate to="/login" replace />
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-gray-500">
        {t('common.cargando-datos-api')}
      </div>
    )
  }
  return <>{children}</>
}

/** Invita a iniciar sesión si ya hay un token activo. */
function GuestOnly({ children }: { children: ReactNode }) {
  if (getToken()) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Guarda de módulo: el rol debe tener asignada la ruta (ROLE_MODULES). */
function ModuleGuard({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useLang()

  if (!canAccessModule(user?.role, path)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <ShieldAlert aria-hidden="true" className="h-12 w-12 text-warning" />
        <div>
          <h2 className="text-h3 text-gray-900">{t('common.modulo-no-disponible')}</h2>
          <p className="mt-1 text-body-sm text-gray-500">
            {t('common.rol-sin-modulo', { role: user?.role ?? t('common.sin-rol') })}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate('/dashboard')}>
          {t('common.volver-al-dashboard')}
        </button>
      </div>
    )
  }
  return <>{children}</>
}

/**
 * Rutas de la aplicación.
 * Cada módulo implementado (Fase 06 → Fase 12) sustituye a
 * PlaceholderPage; las rutas desconocidas muestran la página 404.
 */
const MODULE_ROUTES: Record<string, ReactNode> = {
  '/clientes': <Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>,
  '/productos': <Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>,
  '/categorias': <Suspense fallback={<PageLoader />}><CategoriesPage /></Suspense>,
  '/vendedores': <Suspense fallback={<PageLoader />}><EmployeesPage /></Suspense>,
  '/ventas': <Suspense fallback={<PageLoader />}><SalesPage /></Suspense>,
  '/inventario': <Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>,
  '/analytics': <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>,
  '/probabilidad': <Suspense fallback={<PageLoader />}><ProbabilityPage /></Suspense>,
  '/insights': <Suspense fallback={<PageLoader />}><InsightsPage /></Suspense>,
  '/reportes': <Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>,
  '/configuracion': <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>,
  '/automatizaciones': <Suspense fallback={<PageLoader />}><AutomationPage /></Suspense>,
  '/compras': <Suspense fallback={<PageLoader />}><PurchasingPage /></Suspense>,
  '/cotizaciones': <Suspense fallback={<PageLoader />}><QuotesPage /></Suspense>,
  '/devoluciones': <Suspense fallback={<PageLoader />}><ReturnsPage /></Suspense>,
  '/precios': <Suspense fallback={<PageLoader />}><PricingPage /></Suspense>,
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnly>
        <AuthLayout />
      </GuestOnly>
    ),
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      // Vista 1 (Diseño E): launcher con cards por rol
      { index: true, element: <LauncherPage /> },
      // Vista 2: módulos con topbar + sidebar contextual
      {
        element: <MainLayout />,
        children: [
          {
            path: 'dashboard',
            element: (
              <ModuleGuard path="/dashboard">
                <DashboardPage />
              </ModuleGuard>
            ),
          },
          ...NAV_ITEMS.filter((item) => item.path !== '/dashboard').map((item) => ({
            path: item.path.slice(1),
            element: (
              <ModuleGuard path={item.path}>
                {MODULE_ROUTES[item.path] ?? <PlaceholderPage />}
              </ModuleGuard>
            ),
          })),
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
