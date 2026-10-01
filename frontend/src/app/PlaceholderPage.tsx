import { Link, useLocation } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { PATH_TITLES } from '@/utils/constants'

/**
 * Página genérica para módulos aún no implementados.
 * Aplica el estado EMPTY del sistema de diseño (txt §8).
 */
export default function PlaceholderPage() {
  const { pathname } = useLocation()
  const title = PATH_TITLES[pathname] ?? 'Módulo'

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center shadow-subtle">
      <Layers aria-hidden="true" className="mb-4 h-16 w-16 text-empty" />
      <h2 className="mb-1 text-h4 text-gray-600">{title} — en construcción</h2>
      <p className="mb-6 max-w-md text-body-sm text-gray-400">
        Este módulo se implementará en su fase correspondiente. Consulta el plan en{' '}
        <span className="font-mono text-gray-500">docs/02_arquitectura.md</span>.
      </p>
      <Link to="/" className="btn-primary">
        Volver al Dashboard
      </Link>
    </div>
  )
}
