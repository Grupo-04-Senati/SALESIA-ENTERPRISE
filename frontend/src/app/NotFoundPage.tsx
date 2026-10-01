import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

/**
 * Página 404 para rutas desconocidas.
 * Aplica el estado vacío del sistema de diseño (txt §8).
 */
export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-20 text-center shadow-subtle">
      <Compass aria-hidden="true" className="mb-4 h-16 w-16 text-empty" />
      <h1 className="mb-1 text-h3 text-gray-700">404 · Página no encontrada</h1>
      <p className="mb-6 max-w-md text-body-sm text-gray-400">
        La ruta que buscas no existe en SalesIA Enterprise. Revisa el menú lateral o vuelve al
        Dashboard.
      </p>
      <Link to="/" className="btn-primary">
        Volver al Dashboard
      </Link>
    </div>
  )
}
