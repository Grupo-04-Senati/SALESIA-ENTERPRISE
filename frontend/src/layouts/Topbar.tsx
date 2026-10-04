import { useState } from 'react'
import { Link, useLocation, useNavigation } from 'react-router-dom'
import { Languages, Menu, Moon, Search, Sun } from 'lucide-react'
import { PATH_TITLES, PATH_TITLES_EN } from '@/utils/constants'
import { getTheme, toggleTheme, type Theme } from '@/utils/theme'
import ProgressBar from '@/components/ui/ProgressBar'
import NotificationsMenu from '@/components/ui/NotificationsMenu'
import { useAuth } from '@/hooks/useAuth'
import { useLang } from '@/i18n/i18n'

/**
 * Topbar (Diseño E): 56px, fondo claro, borde inferior fino.
 * Izquierda: marca (clicable al launcher). Centro-derecha: búsqueda,
 * idioma, tema, notificaciones y usuario. `home` oculta el breadcrumb.
 */
interface TopbarProps {
  /** Abre el sidebar en móvil (hamburguesa). */
  onMenu?: () => void
  /** true = vista launcher (sin breadcrumb de módulo). */
  home?: boolean
  /** Buscador controlado (launcher). Sin él, input decorativo. */
  search?: { value: string; onChange: (value: string) => void }
}

export default function Topbar({ onMenu, home = false, search }: TopbarProps) {
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const { user } = useAuth()
  const { lang, toggleLang, t } = useLang()
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  const titles = lang === 'en' ? PATH_TITLES_EN : PATH_TITLES
  const title = titles[pathname] ?? 'SalesIA Enterprise'
  const initials =
    (user?.name ?? 'Usuario')
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'US'

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 print:hidden lg:px-5">
      {/* Hamburguesa (móvil) */}
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-primary hover:text-white lg:hidden"
      >
        <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>

      {/* Marca */}
      <Link to="/" className="flex items-center gap-2.5" aria-label="Ir al inicio">
        <img
          src="/logo.jpg"
          alt="Logo de SalesIA Enterprise"
          className="h-8 w-8 rounded-full object-cover"
        />
        <span className="hidden font-head text-[15px] font-semibold text-gray-900 sm:block">
          SalesIA Enterprise
        </span>
      </Link>

      {/* Breadcrumb píldora */}
      {!home && (
        <div className="ml-2 hidden items-center gap-2 text-body-sm text-gray-500 md:flex">
          <Link to="/" className="transition-colors hover:text-primary">
            SalesIA
          </Link>
          <span aria-hidden="true">/</span>
          <span className="rounded-full bg-[#E8EEFF] px-3 py-1 text-[13px] font-semibold text-primary">
            {title}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Búsqueda */}
      <div className="relative hidden md:block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          placeholder={home ? t('topbar.searchModules') : t('topbar.searchSystem')}
          aria-label={t('topbar.searchLabel')}
          value={search?.value ?? ''}
          onChange={(event) => search?.onChange(event.target.value)}
          className="input h-9 w-56 py-1.5 pl-9 text-body-sm"
        />
      </div>

      {/* Idioma */}
      <button
        type="button"
        aria-label={t('topbar.lang')}
        title={t('topbar.lang')}
        onClick={toggleLang}
        className="flex h-9 items-center justify-center gap-1 rounded-full bg-gray-100 px-2.5 text-gray-500 transition-colors hover:bg-primary hover:text-white"
      >
        <Languages aria-hidden="true" className="h-[18px] w-[18px]" />
        <span className="text-[11px] font-semibold uppercase">{lang}</span>
      </button>

      {/* Acciones */}
      <button
        type="button"
        aria-label={theme === 'dark' ? 'Cambiar a modo claro' : t('topbar.themeDark')}
        title={theme === 'dark' ? 'Modo claro' : t('topbar.themeDark')}
        onClick={() => setTheme(toggleTheme())}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-primary hover:text-white"
      >
        {theme === 'dark' ? (
          <Sun aria-hidden="true" className="h-[18px] w-[18px]" />
        ) : (
          <Moon aria-hidden="true" className="h-[18px] w-[18px]" />
        )}
      </button>

      {/* Notificaciones (avisos reales) */}
      <NotificationsMenu />

      {/* Usuario */}
      <div className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-3">
        <div
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white"
        >
          {initials}
        </div>
        <div className="hidden leading-tight lg:block">
          <p className="text-[13px] font-semibold text-gray-800">{user?.name ?? 'Usuario'}</p>
          <p className="text-[11px] text-gray-400">{user?.role ?? 'Invitado'}</p>
        </div>
      </div>

      {/* Barra de progreso de cargas de ruta */}
      <ProgressBar active={navigation.state === 'loading'} />
    </header>
  )
}
