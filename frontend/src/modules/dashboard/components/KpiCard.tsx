import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  /** Etiqueta del KPI (14px, gris 500) */
  label: string
  /** Valor principal (36px, bold, azul corporativo) */
  value: string
  /** Icono en la esquina superior derecha */
  icon: LucideIcon
  /** Variación frente al periodo anterior, ej. "+8%" */
  trend?: string
  /** true = tendencia verde, false = roja */
  trendUp?: boolean
  /** Texto de contexto secundario */
  hint?: string
}

/**
 * Card KPI del sistema de diseño (txt §5.3):
 * fondo blanco, borde gris 200, radio 12px, padding 24px,
 * icono superior derecha, valor 36px #1E3A8A.
 */
export default function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  hint,
}: KpiCardProps) {
  return (
    <div className="card relative">
      <Icon
        aria-hidden="true"
        className="absolute right-6 top-6 h-6 w-6 text-accent"
      />

      <p className="pr-8 text-body-sm font-medium text-gray-500">{label}</p>

      <p className="mt-2 text-kpi text-primary">{value}</p>

      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={`text-caption font-semibold ${
              trendUp ? 'text-success' : 'text-error'
            }`}
          >
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
        {hint && <span className="text-caption text-gray-500">{hint}</span>}
      </div>
    </div>
  )
}
