import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import PlaceholderPage from './PlaceholderPage'
import LoginPage from '@/modules/auth/pages/LoginPage'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import { NAV_ITEMS } from '@/utils/constants'

/**
 * Rutas de la aplicación.
 * Los módulos no implementados se sirven con PlaceholderPage;
 * se reemplazarán módulo a módulo en fases posteriores.
 */
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
        element: <PlaceholderPage />,
      })),
      { path: '*', element: <PlaceholderPage /> },
    ],
  },
])
