import { useMemo } from 'react'
import { AlertTriangle, RotateCcw, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import { Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/Toast'
import { useDataVersion } from '@/data/DataProvider'
import { RULE_MODULES } from '@/data/rules'
import type { AutomationRule, RuleModule } from '@/data/rules'
import {
  getRules,
  getState,
  isLowStock,
  resetRules,
  ruleNumber,
  setRuleEnabled,
  setRuleParam,
} from '@/data/store'

/**
 * Automatizaciones (Fase 06 · reglas RN-01…RN-47 y RF-03…RF-21).
 *
 * Desde aquí se diseña el comportamiento automático del sistema: cada regla
 * se activa o se desactiva, y sus umbrales se ajustan. El cambio aplica de
 * inmediato en todos los módulos (Ventas, Inventario, Clientes, Productos,
 * Analítica, Probabilidad) sin tocar el código.
 *
 * TODO(Fase 05): el backend evaluará las mismas reglas; el frontend las
 * configura y las muestra (docs/06_reglas.md).
 */

const MODULE_BADGE: Record<RuleModule, 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  Ventas: 'primary',
  Inventario: 'warning',
  Clientes: 'info',
  Productos: 'success',
  Analítica: 'primary',
  Probabilidad: 'neutral',
}

export default function AutomationPage() {
  const toast = useToast()
  const version = useDataVersion()

  const rules = useMemo(() => getRules(), [version])
  const activas = rules.filter((rule) => rule.enabled).length

  // Efecto actual de las reglas configurables sobre los datos reales.
  const efecto = useMemo(() => {
    const state = getState()
    const alertas = state.products.filter((product) => isLowStock(product)).length
    const insights = state.rules.find((rule) => rule.code === 'REG-03_CONCENTRACION')?.enabled
    return [
      {
        label: 'Alertas de stock activas',
        value: `${alertas} producto(s)`,
        detail: `umbral ${ruleNumber('ALERTA_STOCK', 'factor', 100)}% del stock mínimo`,
      },
      {
        label: 'IGV en nuevas ventas',
        value: `${ruleNumber('RN-11_TOTALES', 'taxRate', 18)}%`,
        detail: 'se usa en el total y en los reportes',
      },
      {
        label: 'Alerta de concentración',
        value: insights ? `${ruleNumber('REG-03_CONCENTRACION', 'umbral', 40)}%` : 'desactivada',
        detail: 'participación de un vendedor sobre el periodo',
      },
      {
        label: 'Mínimo para estadística',
        value: `${ruleNumber('RN-40_MINIMO_DATOS', 'minimo', 2)} datos`,
        detail: 'controla media, mediana y clasificación de variables',
      },
    ]
  }, [version])

  const toggle = (rule: AutomationRule) => {
    setRuleEnabled(rule.code, !rule.enabled)
    toast.show(
      rule.enabled ? 'warning' : 'success',
      rule.enabled ? 'Regla desactivada' : 'Regla activada',
      rule.enabled
        ? `${rule.name}: el sistema dejará de aplicar este comportamiento.`
        : `${rule.name}: se aplicará automáticamente en las próximas operaciones.`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Automatizaciones</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-gray-600">
            Diseña el comportamiento automático del sistema: activa o desactiva reglas de negocio y
            ajusta sus umbrales. Los cambios se aplican de inmediato en todos los módulos.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            resetRules()
            toast.success('Configuración restablecida', 'Las reglas volvieron a sus valores por defecto.')
          }}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Restablecer reglas
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Zap aria-hidden="true" className="h-6 w-6 text-primary" />
          </span>
          <div>
            <p className="text-body-sm text-gray-600">Reglas automáticas</p>
            <p className="text-h3 font-bold text-primary">
              {activas} <span className="text-body font-normal text-gray-500">de {rules.length} activas</span>
            </p>
          </div>
        </div>
        <div className="card">
          <p className="text-body-sm font-semibold text-gray-900">Efecto actual de la configuración</p>
          <ul className="mt-2 space-y-1 text-caption text-gray-600">
            {efecto.map((item) => (
              <li key={item.label} className="flex justify-between gap-3">
                <span>
                  {item.label}: <span className="font-semibold text-gray-900">{item.value}</span>
                  <span className="text-gray-400"> · {item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Reglas por módulo */}
      {RULE_MODULES.map((module) => {
        const delModulo = rules.filter((rule) => rule.module === module)
        if (delModulo.length === 0) return null
        return (
          <section key={module} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={MODULE_BADGE[module]}>{module}</Badge>
              <span className="text-caption text-gray-500">
                {delModulo.filter((rule) => rule.enabled).length} de {delModulo.length} activas
              </span>
            </div>

            <div className="space-y-3">
              {delModulo.map((rule) => (
                <article
                  key={rule.code}
                  className={`card flex flex-col gap-3 transition-colors lg:flex-row lg:items-start ${
                    rule.enabled ? '' : 'bg-gray-50 opacity-80'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-body font-semibold text-gray-900">{rule.name}</h2>
                      <span className="font-mono text-caption text-gray-400">{rule.code}</span>
                      {!rule.enabled && <Badge variant="neutral">Desactivada</Badge>}
                    </div>
                    <p className="mt-1 text-body-sm text-gray-600">{rule.description}</p>

                    {rule.params.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-4">
                        {rule.params.map((param) => (
                          <div key={param.key} className="flex items-end gap-2">
                            <div className="w-40">
                              <Input
                                label={param.label}
                                type="number"
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                value={Number(param.value)}
                                disabled={!rule.enabled}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isNaN(value)) setRuleParam(rule.code, param.key, value)
                                }}
                              />
                            </div>
                            <span className="pb-2.5 text-body-sm text-gray-500">{param.unit}</span>
                            {param.help && <span className="pb-2.5 text-caption text-gray-400">{param.help}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 lg:pt-1">
                    <span className={`text-caption font-medium ${rule.enabled ? 'text-success' : 'text-gray-400'}`}>
                      {rule.enabled ? 'Activa' : 'Inactiva'}
                    </span>
                    <Switch
                      checked={rule.enabled}
                      label={`${rule.enabled ? 'Desactivar' : 'Activar'} ${rule.name}`}
                      onChange={() => toggle(rule)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}

      <p className="flex items-start gap-2 rounded-lg bg-info-bg px-4 py-3 text-caption text-info-fg">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Las reglas se guardan en memoria durante la sesión. En la Fase 05 pasarán a la base de datos y
        quedarán registradas en la auditoría del sistema (RF-22).
      </p>
    </div>
  )
}
