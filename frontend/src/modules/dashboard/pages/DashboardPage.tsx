import { ShoppingCart, DollarSign, Activity, Users } from 'lucide-react'
import KpiCard from '../components/KpiCard'

/**
 * Dashboard ejecutivo (RF-09).
 * Los valores reales llegarán con la API (Fase 05 → dashboard/summary);
 * por ahora se muestran como «pendiente» manteniendo el diseño final.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-white">Dashboard</h1>
        <p className="mt-1 text-body-sm text-white/70">
          Resumen ejecutivo de ventas, ingresos y actividad comercial.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ventas del mes"
          value="—"
          icon={ShoppingCart}
          hint="pendiente de API"
        />
        <KpiCard
          label="Ingresos"
          value="—"
          icon={DollarSign}
          hint="pendiente de API"
        />
        <KpiCard
          label="Transacciones"
          value="—"
          icon={Activity}
          hint="pendiente de API"
        />
        <KpiCard
          label="Clientes"
          value="—"
          icon={Users}
          hint="pendiente de API"
        />
      </div>

      <div className="card">
        <h3>Próximos pasos</h3>
        <p className="mt-2 text-body-sm text-gray-600">
          Este dashboard se poblará con datos reales cuando la API{' '}
          <span className="font-mono text-gray-800">GET /dashboard/summary</span>{' '}
          esté disponible (Fase 05 · backend FastAPI). Mientras tanto, el
          sistema de diseño, los KPIs y la navegación ya están operativos.
        </p>
      </div>
    </div>
  )
}
