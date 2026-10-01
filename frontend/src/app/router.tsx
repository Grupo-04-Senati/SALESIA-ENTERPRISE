import { createBrowserRouter } from 'react-router-dom'
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
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/',
    element: <MainLayout />,
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
