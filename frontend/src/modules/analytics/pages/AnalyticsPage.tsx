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
import KpiCard from '@/modules/dashboard/components/KpiCard'
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

/**
 * Dashboard analítico (Fase 10 · RF-09…RF-14): KPIs de ventas,
 * evolución temporal, ventas por producto/vendedor/categoría,
 * distribución de tickets y media/mediana.
 * TODO(Fase 05): los datos definitivos llegarán de statisticsService → API.
 */

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: `1px solid ${CHART_GRID}`,
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
}

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
]

export default function AnalyticsPage() {
  const [months, setMonths] = useState<PeriodMonths>(12)
  const [seller, setSeller] = useState('')
  const [category, setCategory] = useState('')

  const { kpis, monthly, byProduct, bySeller, byCategory, distribution, dataset } = useStatistics({
    months,
    seller,
    category,
  })

  // Alertas que el sistema calcula solo, con las reglas de Automatizaciones.
  const alerts = useMemo(() => getSystemAlerts({ months, seller, category }), [months, seller, category, dataset])

  // Módulos que alimentan estos cálculos: se recalculan con cada cambio (RF-21).
  const version = useDataVersion()
  const sellerNames = useMemo(() => getSellerNames(), [version])
  const categoryNames = useMemo(() => getCategoryNames(), [version])
  const moduleLinks = useMemo(() => {
    const state = getState()
    return [
      { label: 'Ventas', detail: `${state.sales.length} ventas → KPIs, media y mediana`, to: '/ventas', icon: ShoppingCart },
      { label: 'Productos', detail: `${state.products.length} productos → ventas por producto y categoría`, to: '/productos', icon: Package },
      { label: 'Inventario', detail: `${state.movements.length} movimientos → alertas y rotación`, to: '/inventario', icon: Warehouse },
      { label: 'Clientes', detail: `${state.customers.length} clientes → frecuencia y recompra`, to: '/clientes', icon: Users },
      { label: 'Probabilidad', detail: 'Bayes y variables calculados con estos mismos datos', to: '/probabilidad', icon: Percent },
      { label: 'Insights', detail: 'Observaciones automáticas sobre la operación', to: '/insights', icon: Lightbulb },
    ]
  }, [version])

  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Indicadores de ventas, comparaciones y estadística descriptiva (Fase 10).
        </p>
      </div>

      {/* Filtros */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Select
          label="Periodo"
          value={String(months)}
          onChange={(event) => setMonths(Number(event.target.value) as PeriodMonths)}
          className="md:w-52"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select label="Vendedor" value={seller} onChange={(event) => setSeller(event.target.value)} className="md:w-48">
          <option value="">Todos los vendedores</option>
          {sellerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} className="md:w-52">
          <option value="">Todas las categorías</option>
          {categoryNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {/* Alertas automáticas */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h4 text-gray-800">Alertas automáticas</h2>
          <span className="text-caption text-gray-500">
            Se recalculan solas con cada venta o movimiento · reglas en{' '}
            <Link to="/automatizaciones" className="font-medium text-primary hover:underline">
              Automatizaciones
            </Link>
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success-fg">
            Sin alertas: todo está dentro de los umbrales configurados.
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
        <KpiCard label="Ingresos" value={formatCurrency(kpis.ingresos)} icon={DollarSign} hint={`${kpis.variacionMensual >= 0 ? '+' : ''}${kpis.variacionMensual}% vs. mes anterior`} />
        <KpiCard label="Transacciones" value={formatNumber(kpis.transacciones)} icon={ShoppingCart} hint="en el periodo filtrado" />
        <KpiCard label="Ticket promedio" value={formatCurrency(kpis.ticketPromedio)} icon={Receipt} hint="ingresos / transacciones" />
        <KpiCard label="Media vs. mediana" value={formatCurrency(kpis.ticketPromedio)} icon={TrendingUp} hint="estadística descriptiva abajo" />
      </div>

      {/* Evolución temporal */}
      <section className="card">
        <h2 className="text-h4 text-gray-800">Ventas por periodo</h2>
        <p className="mt-1 text-caption text-gray-500">Evolución mensual de ingresos y transacciones (txt §6.2 LineChart). {' '}<Link to="/ventas" className="font-medium text-primary hover:underline">Ver ventas</Link></p>
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
              <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#1E3A8A', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Producto + vendedor */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-h4 text-gray-800">Ventas por producto</h2>
          <p className="mt-1 text-caption text-gray-500">Top productos por ingresos (txt §6.2 BarChart). {' '}<Link to="/productos" className="font-medium text-primary hover:underline">Ver productos</Link></p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h2 className="text-h4 text-gray-800">Ventas por vendedor</h2>
          <p className="mt-1 text-caption text-gray-500">Ingresos atribuidos por vendedor (RF-10). {' '}<Link to="/ventas" className="font-medium text-primary hover:underline">Ver ventas</Link></p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySeller} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Categoría + distribución */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-h4 text-gray-800">Participación por categoría</h2>
          <p className="mt-1 text-caption text-gray-500">Distribución de ingresos por categoría (txt §6.2 PieChart). {' '}<Link to="/productos" className="font-medium text-primary hover:underline">Ver productos</Link></p>
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
          <h2 className="text-h4 text-gray-800">Distribución de tickets</h2>
          <p className="mt-1 text-caption text-gray-500">Frecuencias por rango de ticket promedio (txt §6.2 Histogram). {' '}<Link to="/ventas" className="font-medium text-primary hover:underline">Ver ventas</Link></p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="rango" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="frecuencia" name="Tickets" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Estadística descriptiva */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h3 text-gray-800">Estadística descriptiva</h2>
          <p className="text-body-sm text-gray-600">
            Media, mediana y comparación sobre {formatNumber(dataset.length)} tickets del periodo
            filtrado.{' '}
            <Link to="/probabilidad" className="font-medium text-primary hover:underline">
              Continuar en Probabilidad
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

      {/* Conexión con los módulos */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h3 text-gray-800">Conexión con los módulos</h2>
          <p className="text-body-sm text-gray-600">
            Todo este análisis se calcula solo sobre la operación: registra una venta, un movimiento
            o un cliente y las gráficas, la estadística, Probabilidad e Insights se actualizan
            automáticamente.
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
    </div>
  )
}
