import { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import PlaceholderPage from './PlaceholderPage'
import NotFoundPage from './NotFoundPage'
import LoginPage from '@/modules/auth/pages/LoginPage'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import CustomersPage from '@/modules/customers/pages/CustomersPage'
import ProductsPage from '@/modules/products/pages/ProductsPage'
import SalesPage from '@/modules/sales/pages/SalesPage'
import InventoryPage from '@/modules/inventory/pages/InventoryPage'
import AnalyticsPage from '@/modules/analytics/pages/AnalyticsPage'
import ProbabilityPage from '@/modules/probability/pages/ProbabilityPage'
import InsightsPage from '@/modules/insights/pages/InsightsPage'
import ReportsPage from '@/modules/reports/pages/ReportsPage'
import SettingsPage from '@/modules/settings/pages/SettingsPage'
import AutomationPage from '@/modules/automation/pages/AutomationPage'
import { NAV_ITEMS } from '@/utils/constants'
import { getToken } from '@/services/api'
import { hydrateStore } from '@/services/hydrate'

/**
 * Guarda de sesión: exige token (docs/05 §2.1) y, antes de mostrar las
 * vistas, hidrata el almacén con los datos reales de la API.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setReady(true)
      return
    }
    hydrateStore()
      .catch((error: unknown) => console.error('No se pudieron cargar los datos de la API', error))
      .finally(() => setReady(true))
  }, [])

  if (!getToken()) return <Navigate to="/login" replace />
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-gray-500">
        Cargando datos de la API…
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

/**
 * Rutas de la aplicación.
 * Cada módulo implementado (Fase 06 → Fase 12) sustituye a
 * PlaceholderPage; las rutas desconocidas muestran la página 404.
 */
const MODULE_ROUTES: Record<string, ReactNode> = {
  '/clientes': <CustomersPage />,
  '/productos': <ProductsPage />,
  '/ventas': <SalesPage />,
  '/inventario': <InventoryPage />,
  '/analytics': <AnalyticsPage />,
  '/probabilidad': <ProbabilityPage />,
  '/insights': <InsightsPage />,
  '/reportes': <ReportsPage />,
  '/configuracion': <SettingsPage />,
  '/automatizaciones': <AutomationPage />,
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
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      ...NAV_ITEMS.filter((item) => item.path !== '/').map((item) => ({
        path: item.path.slice(1),
        element: MODULE_ROUTES[item.path] ?? <PlaceholderPage />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
