import { useState } from 'react'
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
import { DollarSign, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { Select } from '@/components/ui/form'
import KpiCard from '@/modules/dashboard/components/KpiCard'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import {
  CATEGORIES,
  CHART_AXIS,
  CHART_GRID,
  SELLERS,
} from '../services/statisticsService'
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
          {SELLERS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} className="md:w-52">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

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
        <p className="mt-1 text-caption text-gray-500">Evolución mensual de ingresos y transacciones (txt §6.2 LineChart).</p>
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
          <p className="mt-1 text-caption text-gray-500">Top productos por ingresos (txt §6.2 BarChart).</p>
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
          <p className="mt-1 text-caption text-gray-500">Ingresos atribuidos por vendedor (RF-10).</p>
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
          <p className="mt-1 text-caption text-gray-500">Distribución de ingresos por categoría (txt §6.2 PieChart).</p>
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
          <p className="mt-1 text-caption text-gray-500">Frecuencias por rango de ticket promedio (txt §6.2 Histogram).</p>
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
          <p className="mt-1 text-body-sm text-gray-600">
            Media, mediana y comparación sobre {formatNumber(dataset.length)} tickets del periodo filtrado.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <MeanPanel values={dataset} />
          <MedianPanel values={dataset} />
          <ComparePanel values={dataset} />
        </div>
      </section>
    </div>
  )
}
