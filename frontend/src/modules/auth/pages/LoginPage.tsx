import { useState } from 'react'
import type { FormEvent } from 'react'

/**
 * Página de Login (Fase 03 — sistema de diseño).
 * La autenticación real contra la API se conecta en la Fase 05.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(
      'La autenticación se conectará al backend en la Fase 05 (API FastAPI).',
    )
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

      {message && (
        <p
          role="status"
          className="rounded-md border border-info bg-info-bg px-3 py-2 text-caption text-info-fg"
        >
          {message}
        </p>
      )}

      <p className="text-center text-caption text-gray-500">
        ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
      </p>
    </form>
  )
}
