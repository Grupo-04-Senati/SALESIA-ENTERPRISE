import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, DollarSign, Info, Lightbulb, Package, Percent, Receipt, ShoppingCart, TrendingUp, Users, Warehouse, XCircle } from 'lucide-react'
import { Select } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import KpiCard from '@/modules/dashboard/components/KpiCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLang } from '@/i18n/i18n'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { useDataVersion } from '@/data/DataProvider'
import { getState } from '@/data/store'
import {
  CHART_AXIS,
  CHART_GRID,
  getCategoryNames,
  getSellerNames,
} from '../services/statisticsService'
import { getSystemAlerts } from '@/data/analytics'
import type { PeriodMonths } from '../services/statisticsService'
import { useStatistics } from '@/hooks/useStatistics'
import MeanPanel from '../components/MeanPanel'
import MedianPanel from '../components/MedianPanel'
import ComparePanel from '../components/ComparePanel'
import SnapshotsPanel from '../components/SnapshotsPanel'

/**
 * Dashboard analítico (Fase 10 · RF-09…RF-14): KPIs de ventas,
 * evolución temporal, ventas por producto/vendedor/categoría,
 * distribución de tickets y media/mediana.
 * Secciones separadas en pestañas: Indicadores · Estadística · Módulos.
 * Sin ventas reales en el periodo, los gráficos muestran estado vacío.
 */

const TAB_ITEMS = [
  { id: 'indicadores', label: 'analytics.indicadores' },
  { id: 'estadistica', label: 'analytics.estadistica-descriptiva' },
  { id: 'modulos', label: 'analytics.conexion-con-los-modulos' },
  { id: 'instantaneas', label: 'analytics.instantaneas' },
]

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: `1px solid ${CHART_GRID}`,
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
}

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '3', label: 'analytics.ultimos-3-meses' },
  { value: '6', label: 'analytics.ultimos-6-meses' },
  { value: '12', label: 'analytics.ultimos-12-meses' },
]

export default function AnalyticsPage() {
  const { t } = useLang()
  const [months, setMonths] = useState<PeriodMonths>(12)
  const [seller, setSeller] = useState('')
  const [category, setCategory] = useState('')
  const [tab, setTab] = useState('indicadores')

  const { kpis, monthly, byProduct, bySeller, byCategory, distribution, dataset } = useStatistics({
    months,
    seller,
    category,
  })

  // Sin ventas reales no se dibujan gráficas: estado vacío (RF-09).
  const sinVentas = kpis.transacciones === 0

  // Alertas que el sistema calcula solo, con las reglas de Automatizaciones.
  const alerts = useMemo(() => getSystemAlerts({ months, seller, category }), [months, seller, category, dataset])

  // Módulos que alimentan estos cálculos: se recalculan con cada cambio (RF-21).
  const version = useDataVersion()
  const sellerNames = useMemo(() => getSellerNames(), [version])
  const categoryNames = useMemo(() => getCategoryNames(), [version])
  const moduleLinks = useMemo(() => {
    const state = getState()
    return [
      {
        label: t('analytics.ventas'),
        detail: t('analytics.n-ventas-kpis-media-y-mediana', { n: state.sales.length }),
        to: '/ventas',
        icon: ShoppingCart,
      },
      {
        label: t('analytics.productos'),
        detail: t('analytics.n-productos-ventas-por-producto-y-categoria', {
          n: state.products.length,
        }),
        to: '/productos',
        icon: Package,
      },
      {
        label: t('analytics.inventario'),
        detail: t('analytics.n-movimientos-alertas-y-rotacion', { n: state.movements.length }),
        to: '/inventario',
        icon: Warehouse,
      },
      {
        label: t('analytics.clientes'),
        detail: t('analytics.n-clientes-frecuencia-y-recompra', { n: state.customers.length }),
        to: '/clientes',
        icon: Users,
      },
      {
        label: t('analytics.probabilidad'),
        detail: t('analytics.bayes-y-variables-calculados-con-estos-mismos-datos'),
        to: '/probabilidad',
        icon: Percent,
      },
      {
        label: t('analytics.insights'),
        detail: t('analytics.observaciones-automaticas-sobre-la-operacion'),
        to: '/insights',
        icon: Lightbulb,
      },
    ]
  }, [version, t])

  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          {t('analytics.indicadores-de-ventas-comparaciones-y-estadistica-descriptiva-fase-10')}
        </p>
      </div>

      {/* Filtros */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Select
          label={t('analytics.periodo')}
          value={String(months)}
          onChange={(event) => setMonths(Number(event.target.value) as PeriodMonths)}
          className="md:w-52"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </Select>
        <Select
          label={t('analytics.vendedor')}
          value={seller}
          onChange={(event) => setSeller(event.target.value)}
          className="md:w-48"
        >
          <option value="">{t('analytics.todos-los-vendedores')}</option>
          {sellerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          label={t('analytics.categoria')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="md:w-52"
        >
          <option value="">{t('analytics.todas-las-categorias')}</option>
          {categoryNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="analytics" />

      {/* Indicadores: alertas, KPIs y gráficas */}
      <TabPanel tabId="indicadores" active={tab === 'indicadores'}>
        <div className="space-y-6">
          {/* Alertas automáticas */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h4 text-gray-800">{t('analytics.alertas-automaticas')}</h2>
              <span className="text-caption text-gray-500">
                {t('analytics.se-recalculan-solas-con-cada-venta-o-movimiento-reglas-en')}{' '}
                <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
                  {t('analytics.automatizaciones')}
                </Link>
              </span>
            </div>

            {alerts.length === 0 ? (
              <p className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success-fg">
                {t('analytics.sin-alertas-todo-esta-dentro-de-los-umbrales-configurados')}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {alerts.map((alert) => {
                  const Icon = alert.severity === 'error' ? XCircle : alert.severity === 'warning' ? AlertTriangle : Info
                  const tone =
                    alert.severity === 'error'
                      ? 'border-error bg-error-bg text-error-fg'
                      : alert.severity === 'warning'
                        ? 'border-warning bg-warning-bg text-warning-fg'
                        : 'border-info bg-info-bg text-info-fg'
                  return (
                    <li key={alert.id} className={`rounded-lg border p-3 ${tone}`}>
                      <div className="flex items-start gap-2">
                        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-body-sm font-semibold">{alert.title}</p>
                          <p className="mt-0.5 text-caption opacity-90">{alert.detail}</p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* KPIs */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={t('analytics.ingresos')}
              value={formatCurrency(kpis.ingresos)}
              icon={DollarSign}
              hint={`${kpis.variacionMensual >= 0 ? '+' : ''}${kpis.variacionMensual}% ${t('analytics.vs-mes-anterior')}`}
            />
            <KpiCard
              label={t('analytics.transacciones')}
              value={formatNumber(kpis.transacciones)}
              icon={ShoppingCart}
              hint={t('analytics.en-el-periodo-filtrado')}
            />
            <KpiCard
              label={t('analytics.ticket-promedio')}
              value={formatCurrency(kpis.ticketPromedio)}
              icon={Receipt}
              hint={t('analytics.ingresos-transacciones')}
            />
            <KpiCard
              label={t('analytics.media-vs-mediana')}
              value={formatCurrency(kpis.ticketPromedio)}
              icon={TrendingUp}
              hint={t('analytics.estadistica-descriptiva-abajo')}
            />
          </div>

          {sinVentas ? (
            <div className="card">
              <EmptyState
                title={t('analytics.sin-ventas-en-el-periodo')}
                description={t(
                  'analytics.todavia-no-hay-ventas-registradas-con-estos-filtros-en-cuanto-registres-la-primera-veras-aqui-la-evolucion-el-ranking-por-producto-y-vendedor-la-participacion-por-categoria-y-la-distribucion-de-tickets',
                )}
                action={
                  <Link to="/ventas" className="btn-primary">
                    {t('analytics.registrar-venta')}
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              {/* Evolución temporal */}
              <section className="card">
                <h2 className="text-h4 text-gray-800">{t('analytics.ventas-por-periodo')}</h2>
                <p className="mt-1 text-caption text-gray-500">
                  {t('analytics.evolucion-mensual-de-ingresos-y-transacciones-txt-62-linechart')}{' '}
                  <Link to="/ventas" className="font-medium text-primary hover:underline">
                    {t('analytics.ver-ventas')}
                  </Link>
                </p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" />
                      <XAxis dataKey="mes" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                      <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => (name === 'ingresos' ? formatCurrency(Number(value)) : formatNumber(Number(value)))}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: CHART_AXIS }} />
                      <Line type="monotone" dataKey="ingresos" name={t('analytics.ingresos')} stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#1E3A8A', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Producto + vendedor */}
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card">
                  <h2 className="text-h4 text-gray-800">{t('analytics.ventas-por-producto')}</h2>
                  <p className="mt-1 text-caption text-gray-500">
                    {t('analytics.top-productos-por-ingresos-txt-62-barchart')}{' '}
                    <Link to="/productos" className="font-medium text-primary hover:underline">
                      {t('analytics.ver-productos')}
                    </Link>
                  </p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byProduct} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" horizontal={false} />
                        <XAxis type="number" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="ingresos" name={t('analytics.ingresos')} fill="#1E3A8A" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="card">
                  <h2 className="text-h4 text-gray-800">{t('analytics.ventas-por-vendedor')}</h2>
                  <p className="mt-1 text-caption text-gray-500">
                    {t('analytics.ingresos-atribuidos-por-vendedor-rf-10')}{' '}
                    <Link to="/ventas" className="font-medium text-primary hover:underline">
                      {t('analytics.ver-ventas')}
                    </Link>
                  </p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bySeller} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                        <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="ingresos" name={t('analytics.ingresos')} fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              {/* Categoría + distribución */}
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="card">
                  <h2 className="text-h4 text-gray-800">{t('analytics.participacion-por-categoria')}</h2>
                  <p className="mt-1 text-caption text-gray-500">
                    {t('analytics.distribucion-de-ingresos-por-categoria-txt-62-piechart')}{' '}
                    <Link to="/productos" className="font-medium text-primary hover:underline">
                      {t('analytics.ver-productos')}
                    </Link>
                  </p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategory} dataKey="ingresos" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                          {byCategory.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                        <Legend wrapperStyle={{ fontSize: 12, color: CHART_AXIS }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="card">
                  <h2 className="text-h4 text-gray-800">{t('analytics.distribucion-de-tickets')}</h2>
                  <p className="mt-1 text-caption text-gray-500">
                    {t('analytics.frecuencias-por-rango-de-ticket-promedio-txt-62-histogram')}{' '}
                    <Link to="/ventas" className="font-medium text-primary hover:underline">
                      {t('analytics.ver-ventas')}
                    </Link>
                  </p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="rango" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                        <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="frecuencia" name={t('analytics.tickets')} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </TabPanel>

      {/* Estadística descriptiva */}
      <TabPanel tabId="estadistica" active={tab === 'estadistica'}>
        <section className="space-y-4">
          <div>
            <h2 className="text-h3 text-gray-800">{t('analytics.estadistica-descriptiva')}</h2>
            <p className="text-body-sm text-gray-600">
              {t('analytics.media-mediana-y-comparacion-sobre-n-tickets-del-periodo-filtrado', {
                n: dataset.length,
              })}{' '}
              <Link to="/probabilidad" className="font-medium text-primary hover:underline">
                {t('analytics.continuar-en-probabilidad')}
              </Link>
              .
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <MeanPanel values={dataset} />
            <MedianPanel values={dataset} />
            <ComparePanel values={dataset} />
          </div>
        </section>
      </TabPanel>

      {/* Conexión con los módulos */}
      <TabPanel tabId="modulos" active={tab === 'modulos'}>
        <section className="space-y-4">
          <div>
            <h2 className="text-h3 text-gray-800">{t('analytics.conexion-con-los-modulos')}</h2>
            <p className="text-body-sm text-gray-600">
              {t(
                'analytics.todo-este-analisis-se-calcula-solo-sobre-la-operacion-registra-una-venta-un-movimiento-o-un-cliente-y-las-graficas-la-estadistica-probabilidad-e-insights-se-actualizan-automaticamente',
              )}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {moduleLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="card flex items-start gap-3 transition-colors hover:border-primary"
                >
                  <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-body-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-0.5 text-caption text-gray-500">{item.detail}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </TabPanel>

      {/* Instantáneas de KPI */}
      <TabPanel tabId="instantaneas" active={tab === 'instantaneas'}>
        <SnapshotsPanel />
      </TabPanel>
    </div>
  )
}
