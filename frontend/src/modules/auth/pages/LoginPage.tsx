import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Página de Login (Fase 05 — autenticación real contra la API).
 * POST /api/v1/auth/login (docs/05_api.md §2.1); el token queda guardado
 * y la guardia RequireAuth hidrata los datos antes de entrar al sistema.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-body-sm font-medium text-gray-700"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-body-sm font-medium text-gray-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Ingresando…' : 'Iniciar sesión'}
      </button>

      <p className="rounded-md border border-info bg-info-bg px-3 py-2 text-center text-caption text-info-fg">
        Usuarios de demostración: admin@salesia.com · gerente@salesia.com ·
        vendedor@salesia.com · analista@salesia.com · almacen@salesia.com
        <br />
        Contraseña: admin123
      </p>

      <p className="text-center text-caption text-gray-500">
        ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
      </p>
    </form>
  )
}
