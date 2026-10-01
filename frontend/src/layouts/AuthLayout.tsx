import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'

// Fondo «Particles ocean» (vgpu fft-ocean) cargado de forma diferida:
// no retrasa el primer render del login.
const OceanBackground = lazy(() => import('@/components/OceanBackground'))

/**
 * Layout de autenticación (txt §7.2):
 * fondo con gradiente azul corporativo → cyan (respaldo) sobre el que se
 * renderiza el océano de partículas WebGPU; tarjeta central blanca de 400px
 * con logo, título y subtítulo.
 */
export default function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary to-accent">
      <Suspense fallback={null}>
        <OceanBackground />
      </Suspense>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[400px] rounded-lg bg-white p-8 shadow-large">
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src="/logo.jpg"
              alt="Logo de SalesIA Enterprise"
              className="mb-4 h-16 w-16 rounded-full object-cover"
            />
            <h1 className="text-h2 text-gray-900">SalesIA Enterprise</h1>
            <p className="mt-1 text-body-sm text-gray-600">
              Sistema de Gestión y Analítica
            </p>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
