import { Outlet } from 'react-router-dom'

/**
 * Layout de autenticación (txt §7.2):
 * fondo con gradiente azul corporativo → cyan,
 * tarjeta central blanca de 400px con logo, título y subtítulo.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-accent p-6">
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
  )
}
