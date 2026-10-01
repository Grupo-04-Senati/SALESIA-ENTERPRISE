import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, DollarSign, Lightbulb, Percent, Receipt, ShoppingCart, TrendingUp, Users, Warehouse } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { CHART_AXIS, CHART_GRID } from '@/modules/analytics/services/statisticsService'
import { useStatistics } from '@/hooks/useStatistics'
import { listCustomers } from '@/modules/customers/services/customerService'
import { listStock } from '@/modules/inventory/services/inventoryService'
import { useEffect, useState } from 'react'

/**
 * Dashboard ejecutivo (Fase 10 · RF-09).
 * Resume ventas, ingresos, clientes y alertas de stock, y da acceso
 * rápido a cada módulo.
 * TODO(Fase 05): los valores definitivos llegarán de
 * GET /api/v1/dashboard/summary; aquí se calculan con el servicio de
 * analítica para que la vista sea real desde ya.
 */

const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: `1px solid ${CHART_GRID}`,
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
}

const QUICK_LINKS = [
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/ventas', label: 'Registrar venta', icon: ShoppingCart },
  { to: '/inventario', label: 'Inventario', icon: Warehouse },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
]

export default function DashboardPage() {
  const { kpis, monthly, byProduct, compare } = useStatistics({ months: 12, seller: '', category: '' })
  const [totalClientes, setTotalClientes] = useState<number | null>(null)
  const [alertasStock, setAlertasStock] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listCustomers(), listStock()])
      .then(([customers, stock]) => {
        if (cancelled) return
        setTotalClientes(customers.length)
        setAlertasStock(stock.filter((row) => row.current_stock <= row.min_stock).length)
      })
      .catch(() => {
        // Los KPIs del dashboard toleran que el catálogo no cargue.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1>Dashboard</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Resumen ejecutivo de ventas, ingresos y actividad comercial.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ventas del mes"
          value={formatNumber(monthly[monthly.length - 1]?.transacciones ?? 0)}
          icon={ShoppingCart}
          hint={`${monthly[monthly.length - 1]?.mes ?? ''} · ${kpis.variacionMensual >= 0 ? '+' : ''}${kpis.variacionMensual}% vs. mes anterior`}
        />
        <KpiCard label="Ingresos" value={formatCurrency(kpis.ingresos)} icon={DollarSign} hint="últimos 12 meses" />
        <KpiCard
          label="Ticket promedio"
          value={formatCurrency(kpis.ticketPromedio)}
          icon={Receipt}
          hint={`media S/ ${compare.mean.toFixed(2)} · mediana S/ ${compare.median.toFixed(2)}`}
        />
        <KpiCard
          label="Clientes"
          value={totalClientes === null ? '—' : formatNumber(totalClientes)}
          icon={Users}
          hint={alertasStock === null ? 'cargando…' : `${alertasStock} producto(s) con stock bajo`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 text-gray-800">Evolución de ventas</h2>
            <Link to="/analytics" className="inline-flex items-center gap-1 text-caption text-primary hover:underline">
              Ver analytics <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" />
                <XAxis dataKey="mes" tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
                <YAxis tick={{ fill: CHART_AXIS, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#1E3A8A', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h2 className="text-h4 text-gray-800">Top productos</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct.slice(0, 5)} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Accesos rápidos */}
      <section className="space-y-4">
        <h2 className="text-h3 text-gray-800">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.to}
                to={link.to}
                className="card flex items-center gap-3 transition-colors hover:border-primary-light"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                </span>
                <span className="text-body-sm font-semibold text-gray-900">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Estado de la fase */}
      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp aria-hidden="true" className="h-5 w-5 text-primary" />
          <div>
            <p className="text-body-sm font-semibold text-gray-900">Frontend completo (Fase 06 · Fase 12)</p>
            <p className="text-caption text-gray-500">
              Los datos mostrados provienen del servicio de analítica; en la Fase 05 los supplantará
              la API real (FastAPI).
            </p>
          </div>
        </div>
        <Link to="/reportes" className="btn-outline">
          <Percent aria-hidden="true" className="mr-2 h-4 w-4" />
          Ver reportes
        </Link>
      </section>
    </div>
  )
}
