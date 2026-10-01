import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'

/**
 * Página de Login (Fase 03 — sistema de diseño).
 *
 * MODO DEMO: la autenticación real contra la API se implementa en la
 * Fase 05 (POST /api/v1/auth/login). Mientras tanto, cualquier correo
 * y contraseña abren la aplicación para poder revisar el diseño.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // TODO(Fase 05): sustituir por llamada real a la API de autenticación.
    navigate('/', { replace: true })
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

      <button type="submit" className="btn-primary w-full">
        Iniciar sesión
      </button>

      <p className="rounded-md border border-info bg-info-bg px-3 py-2 text-center text-caption text-info-fg">
        Modo demo: cualquier correo y contraseña abren la aplicación.
        <br />
        La autenticación real se conecta en la Fase 05 (API FastAPI).
      </p>

      <p className="text-center text-caption text-gray-500">
        ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
      </p>
    </form>
  )
}
