import { BarChart3, Languages, ShieldCheck, Zap } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useLang } from '@/i18n/i18n'

/**
 * Layout de autenticación — Diseño E (webadmin):
 * panel izquierdo azul con la marca y el valor del producto,
 * formulario a la derecha sobre fondo claro (oscuro en dark mode).
 */
export default function AuthLayout() {
  const { t, lang, toggleLang } = useLang()
  const HIGHLIGHTS = [
    { icon: BarChart3, text: t('auth.hl1') },
    { icon: ShieldCheck, text: t('auth.hl2') },
    { icon: Zap, text: t('auth.hl3') },
  ] as const
  return (
    <div className="relative flex min-h-screen bg-gray-50">
      {/* Selector de idioma (login no tiene topbar) */}
      <button
        type="button"
        aria-label={t('topbar.lang')}
        title={t('topbar.lang')}
        onClick={toggleLang}
        className="absolute right-4 top-4 z-10 flex h-9 items-center justify-center gap-1 rounded-full bg-white px-3 text-gray-500 shadow-subtle transition-colors hover:bg-primary hover:text-white"
      >
        <Languages aria-hidden="true" className="h-[17px] w-[17px]" />
        <span className="text-[11px] font-semibold uppercase">{lang}</span>
      </button>
      {/* Panel de marca */}
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-primary p-10 text-white md:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5"
        />

        <div className="relative flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Logo de SalesIA Enterprise"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white/40"
          />
          <div>
            <p className="font-head text-base font-semibold">SalesIA Enterprise</p>
            <p className="text-caption text-white/70">{t('auth.brandSub')}</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-sm font-head text-[30px] font-semibold leading-9 text-white">
            {t('auth.headline')}
          </h1>
          <p className="mt-3 max-w-sm text-body-sm text-white/75">{t('auth.lead')}</p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-body-sm text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-caption text-white/60">
          © {new Date().getFullYear()} SalesIA Enterprise · Senati
        </p>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex flex-col items-center text-center md:hidden">
            <img
              src="/logo.jpg"
              alt="Logo de SalesIA Enterprise"
              className="mb-3 h-14 w-14 rounded-full object-cover"
            />
            <h1 className="text-h3 text-gray-900">SalesIA Enterprise</h1>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
