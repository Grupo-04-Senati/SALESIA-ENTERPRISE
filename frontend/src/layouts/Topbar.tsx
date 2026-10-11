import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useNavigation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ghost, Languages, LogOut, Menu, Moon, Search, Settings, Sun } from 'lucide-react'
import { PATH_TITLES, PATH_TITLES_EN, canAccessModule, canSubmodule } from '@/utils/constants'
import { getTheme, toggleTheme, type Theme } from '@/utils/theme'
import ProgressBar from '@/components/ui/ProgressBar'
import NotificationsMenu from '@/components/ui/NotificationsMenu'
import { useAuth } from '@/hooks/useAuth'
import { useLang } from '@/i18n/i18n'
import { usePrank } from '@/prank/PrankContext'

/**
 * Topbar (Diseño E): 56px, fondo claro, borde inferior fino.
 * Izquierda: marca (clicable al launcher). Centro-derecha: búsqueda,
 * idioma, engranaje de configuración (secciones que el rol puede ver),
 * tema, notificaciones y usuario. `home` oculta el breadcrumb.
 */
interface TopbarProps {
  /** Abre el sidebar en móvil (hamburguesa). */
  onMenu?: () => void
  /** true = vista launcher (sin breadcrumb de módulo). */
  home?: boolean
  /** Buscador controlado (launcher). Sin él, input decorativo. */
  search?: { value: string; onChange: (value: string) => void }
}

/** Secciones de Configuración enlazables desde el engranaje de la topbar. */
const SETTINGS_LINKS: { id: string; label: string; adminOnly?: boolean }[] = [
  { id: 'perfil', label: 'settings.mi-perfil' },
  { id: 'parametros', label: 'settings.parametros' },
  { id: 'usuarios', label: 'settings.usuarios-y-roles', adminOnly: true },
  { id: 'roles', label: 'settings.roles', adminOnly: true },
  { id: 'sistema', label: 'settings.sistema' },
  { id: 'notificaciones', label: 'settings.notificaciones' },
  { id: 'exportaciones', label: 'settings.exportaciones' },
  { id: 'reportes', label: 'settings.reportes' },
]

export default function Topbar({ onMenu, home = false, search }: TopbarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { user, logout } = useAuth()
  const { lang, toggleLang, t } = useLang()
  const [searchParams] = useSearchParams()
  const { armed, setArmed } = usePrank()
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const titles = lang === 'en' ? PATH_TITLES_EN : PATH_TITLES
  const title = titles[pathname] ?? 'SalesIA Enterprise'
  const initials =
    (user?.name ?? 'Usuario')
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'US'

  // Cierra el menú de configuración al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!settingsOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const showSettings = canAccessModule(user, '/configuracion')
  const settingsLinks = SETTINGS_LINKS.filter((link) =>
    link.adminOnly
      ? user?.role === 'Admin'
      : canSubmodule(user, '/configuracion', link.id),
  )

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 print:hidden lg:px-5">
      {/* Hamburguesa (abre/ancla la barra lateral) */}
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-primary hover:text-white"
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

      {/* Retroceso: volver al launcher de módulos */}
      {!home && (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="ml-1 flex h-8 items-center gap-1.5 rounded-full bg-gray-100 pl-2.5 pr-3 text-[13px] font-medium text-gray-600 transition-colors hover:bg-primary hover:text-white"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t('topbar.back')}
        </button>
      )}

      {/* Breadcrumb píldora */}
      {!home && (
        <div className="ml-2 hidden items-center gap-2 text-body-sm text-gray-500 md:flex">
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

      {/* Broma: arma/desarma el modo árabe (tecla A) */}
      <button
        type="button"
        aria-label={armed ? t('topbar.prankOff') : t('topbar.prank')}
        title={armed ? t('topbar.prankOff') : t('topbar.prank')}
        aria-pressed={armed}
        onClick={() => setArmed(!armed)}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          armed
            ? 'bg-primary text-white shadow-sm'
            : 'bg-gray-100 text-gray-500 hover:bg-primary hover:text-white'
        }`}
      >
        <Ghost aria-hidden="true" className="h-[18px] w-[18px]" />
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

      {/* Engranaje: secciones de Configuración que el rol puede abrir */}
      {showSettings && (
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            aria-label={t('topbar.settings')}
            title={t('topbar.settings')}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              settingsOpen
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-primary hover:text-white'
            }`}
          >
            <Settings aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          {settingsOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
            >
              <p className="px-3 pb-1.5 pt-1 text-caption font-semibold uppercase tracking-wide text-gray-400">
                {t('topbar.settings')}
              </p>
              {settingsLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(false)
                    navigate(`/configuracion?tab=${link.id}`)
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-body-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary"
                >
                  {t(link.label)}
                  {pathname === '/configuracion' && searchParams.get('tab') === link.id && (
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-error transition-colors hover:bg-error-bg"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {t('sidebar.logout')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notificaciones (avisos reales) */}
      <NotificationsMenu />

      {/* Usuario */}
      <div className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-3">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            aria-hidden="true"
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white"
          >
            {initials}
          </div>
        )}
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
