import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { Info, Lock, LogIn, Mail, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLang } from '@/i18n/i18n'

/**
 * Página de Login (Diseño E):
 * tarjeta blanca radio 12, inputs con ícono izquierdo (36px),
 * botón azul radio 8 con sombra y aviso de credenciales suave.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLang()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-subtle">
      <div className="mb-6">
        <h2 className="text-h3 text-gray-900">{t('login.welcome')}</h2>
        <p className="mt-1 text-body-sm text-gray-500">{t('login.sub')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-body-sm font-medium text-gray-700"
          >
            {t('login.email')}
          </label>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t('login.email-placeholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-body-sm font-medium text-gray-700"
          >
            {t('login.password')}
          </label>
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-bg px-3 py-2.5 text-caption text-error-fg"
          >
            <TriangleAlert aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          <LogIn aria-hidden="true" className="h-4 w-4" />
          {loading ? t('login.submitting') : t('login.submit')}
        </button>

        <div className="flex items-start gap-2 rounded-xl bg-gray-100 px-3.5 py-3 text-caption text-gray-500">
          <Info aria-hidden="true" className="mt-px h-4 w-4 text-primary" />
          <span>
            {t('login.hint')} <b className="font-semibold text-gray-700">admin@salesia.com</b>
            <br />
            {t('login.passwordLabel')} <b className="font-semibold text-gray-700">admin123</b>
          </span>
        </div>

        <p className="text-center text-caption text-gray-400">{t('login.forgot')}</p>
      </form>
    </div>
  )
}
