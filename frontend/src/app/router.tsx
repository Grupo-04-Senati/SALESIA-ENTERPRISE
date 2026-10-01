import { createBrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import PlaceholderPage from './PlaceholderPage'
import LoginPage from '@/modules/auth/pages/LoginPage'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import CustomersPage from '@/modules/customers/pages/CustomersPage'
import ProductsPage from '@/modules/products/pages/ProductsPage'
import { NAV_ITEMS } from '@/utils/constants'

/**
 * Rutas de la aplicación.
 * Los módulos implementados sustituyen a PlaceholderPage aquí;
 * los pendientes se irán añadiendo por fase (Fase 07 → Fase 12).
 */
const MODULE_ROUTES: Record<string, ReactNode> = {
  '/clientes': <CustomersPage />,
  '/productos': <ProductsPage />,
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
      { path: '*', element: <PlaceholderPage /> },
    ],
  },
])
