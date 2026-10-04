import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, SearchX } from 'lucide-react'
import Topbar from '@/layouts/Topbar'
import { GROUP_LABELS, GROUP_LABELS_EN, visibleModules } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'
import { useLang } from '@/i18n/i18n'
import { useStatistics } from '@/hooks/useStatistics'
import { listCustomers } from '@/modules/customers/services/customerService'
import { formatCurrency, formatNumber } from '@/utils/formatters'

/**
 * Launcher (Diseño E · vista 1): primera pantalla tras el login.
 * Hero con saludo + KPIs rápidos, buscador y secciones con las cards
 * de los módulos asignados al rol del usuario. Clic → módulo.
 */

const GROUPS = ['operacion', 'analitica', 'sistema'] as const

export default function LauncherPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, t } = useLang()
  const { kpis, monthly } = useStatistics({ months: 12, seller: '', category: '' })
  const [query, setQuery] = useState('')
  const [totalClientes, setTotalClientes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listCustomers()
      .then((customers) => {
        if (!cancelled) setTotalClientes(customers.length)
      })
      .catch(() => {
        // El hero tolera que el catálogo no cargue.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (user?.name ?? t('common.usuario')).split(' ')[0]
  const fecha = useMemo(() => {
    try {
      return new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }, [lang])

  const groupLabels = lang === 'en' ? GROUP_LABELS_EN : GROUP_LABELS
  const visible = visibleModules(user?.role)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? visible.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.labelEn.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.descEn.toLowerCase().includes(q),
      )
    : visible
  const sinResultados = filtered.length === 0

  const heroKpis = [
    { label: t('launcher.kpiMonth'), value: formatNumber(monthly[monthly.length - 1]?.transacciones ?? 0) },
    { label: t('launcher.kpiIncome'), value: formatCurrency(kpis.ingresos) },
    {
      label: t('launcher.kpiClients'),
      value: totalClientes === null ? '—' : formatNumber(totalClientes),
    },
  ]

  return (
    <div className="min-h-screen">
      <Topbar home search={{ value: query, onChange: setQuery }} />

      <div className="mx-auto w-full max-w-[1700px] px-5 pb-24 pt-4">
        {/* Hero */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-subtle">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[23px] leading-7 text-gray-900">
                {t('launcher.greet')}, <span className="text-primary">{firstName}</span>
              </h1>
              <p className="mt-1 text-body-sm text-gray-500">{t('launcher.lead')}</p>
              <p className="mt-2 text-caption text-gray-400">{fecha}</p>
            </div>

            <div className="flex flex-wrap items-center gap-6 lg:gap-8">
              {heroKpis.map((kpi, index) => (
                <div
                  key={kpi.label}
                  className={`flex flex-col ${index > 0 ? 'border-l border-gray-200 pl-6 lg:pl-8' : ''}`}
                >
                  <span className="text-caption text-gray-500">{kpi.label}</span>
                  <span className="mt-0.5 font-head text-xl font-semibold tabular-nums text-gray-900">
                    {kpi.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Secciones + cards */}
        {sinResultados ? (
          <div className="mt-16 flex flex-col items-center text-center text-gray-500">
            <SearchX aria-hidden="true" className="h-10 w-10 text-gray-400" />
            <p className="mt-3 text-body font-medium text-gray-700">{t('launcher.emptyTitle')}</p>
            <p className="mt-1 text-body-sm">{t('launcher.emptyBody')}</p>
          </div>
        ) : (
          GROUPS.map((group) => {
            const items = filtered.filter((item) => item.group === group)
            if (items.length === 0) return null
            return (
              <section key={group}>
                <div className="sec-head">
                  <h2 className="text-h4 text-gray-900">{groupLabels[group]}</h2>
                  <span className="rounded-full bg-[#E8EEFF] px-2.5 py-1 text-[10px] font-medium text-primary">
                    {t('launcher.modules', { n: items.length })}
                  </span>
                  <span className="rule" />
                </div>

                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                  {items.map((item) => {
                    const Icon = item.icon
                    const label = lang === 'en' ? item.labelEn : item.label
                    const desc = lang === 'en' ? item.descEn : item.desc
                    return (
                      <button
                        key={item.path}
                        type="button"
                        className="mcard mcard-tile"
                        onClick={() => navigate(item.path)}
                      >
                        <img
                          className="mcard-img"
                          src={item.img}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = 'hidden'
                          }}
                        />
                        <span className="mcard-foot">
                          <span className="mcard-ico">
                            <Icon aria-hidden="true" className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold leading-5 text-gray-900">
                              {label}
                            </span>
                            <span className="mt-0.5 block text-[13px] font-medium leading-4 text-gray-500">
                              {desc}
                            </span>
                          </span>
                          <span className="mcard-arrow">
                            <ChevronRight aria-hidden="true" className="h-4 w-4" />
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
