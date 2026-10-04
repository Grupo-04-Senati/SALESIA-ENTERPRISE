import { CheckCircle2 } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import { useLang } from '@/i18n/i18n'
import type { ProcessTrace } from '@/data/store'

/**
 * Trazabilidad de un proceso (Fase 08 — guardar trazabilidad).
 * Muestra paso a paso qué hizo el sistema al ejecutar una operación:
 * p. ej. al registrar una venta se ve el stock que bajó, el movimiento
 * generado en el kardex y el historial del cliente actualizado.
 */

const MODULE_STYLES: Record<string, string> = {
  ventas: 'bg-primary/10 text-primary',
  inventario: 'bg-warning-bg text-warning-fg',
  clientes: 'bg-info-bg text-info-fg',
  productos: 'bg-success-bg text-success-fg',
  analítica: 'bg-gray-100 text-gray-600',
}

interface ProcessTraceCardProps {
  trace: ProcessTrace
  className?: string
}

export default function ProcessTraceCard({ trace, className }: ProcessTraceCardProps) {
  const { t } = useLang()
  return (
    <div className={cn('rounded-lg border border-success bg-success-bg p-4', className)}>
      <div className="flex items-center gap-2">
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-success" />
        <div>
          <p className="text-body-sm font-semibold text-success-fg">
            {t('common.proceso-ejecutado')}: {trace.title}
          </p>
          <p className="text-caption text-success-fg/80">{formatDateTime(trace.at)}</p>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {trace.steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-start gap-2 text-caption text-success-fg">
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide',
                MODULE_STYLES[step.module] ?? MODULE_STYLES['analítica'],
              )}
            >
              {step.module}
            </span>
            <span>
              <span className="font-semibold">{step.label}:</span> {step.detail}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
