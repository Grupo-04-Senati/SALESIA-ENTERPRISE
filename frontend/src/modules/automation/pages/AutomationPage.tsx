import { useMemo, useState } from 'react'
import { AlertTriangle, RotateCcw, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import SavedRulesPanel from '../components/SavedRulesPanel'
import { Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/Toast'
import { useDataVersion } from '@/data/DataProvider'
import { useLang } from '@/i18n/i18n'
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
 * Analítica, Probabilidad) sin tocar el código. Las reglas se separan por
 * módulo en pestañas.
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

const MODULE_LABEL_KEYS: Record<RuleModule, string> = {
  Ventas: 'automation.ventas',
  Inventario: 'automation.inventario',
  Clientes: 'automation.clientes',
  Productos: 'automation.productos',
  Analítica: 'automation.analitica',
  Probabilidad: 'automation.probabilidad',
}

const TAB_ITEMS = [
  { id: 'guardadas', label: 'automation.guardadas' },
  { id: 'todas', label: 'automation.todas' },
  ...RULE_MODULES.map((module) => ({ id: module, label: MODULE_LABEL_KEYS[module] })),
]

export default function AutomationPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()
  const [tab, setTab] = useState('todas')

  const rules = useMemo(() => getRules(), [version])
  const activas = rules.filter((rule) => rule.enabled).length
  // Módulos visibles según la pestaña seleccionada.
  const modulosVisibles = RULE_MODULES.filter((module) => tab === 'todas' || tab === module)

  // Efecto actual de las reglas configurables sobre los datos reales.
  const efecto = useMemo(() => {
    const state = getState()
    const alertas = state.products.filter((product) => isLowStock(product)).length
    const insights = state.rules.find((rule) => rule.code === 'REG-03_CONCENTRACION')?.enabled
    return [
      {
        label: t('automation.alertas-de-stock-activas'),
        value: t('automation.n-productos', { n: alertas }),
        detail: t('automation.umbral-n-del-stock-minimo', {
          n: ruleNumber('ALERTA_STOCK', 'factor', 100),
        }),
      },
      {
        label: t('automation.igv-en-nuevas-ventas'),
        value: `${ruleNumber('RN-11_TOTALES', 'taxRate', 18)}%`,
        detail: t('automation.se-usa-en-el-total-y-en-los-reportes'),
      },
      {
        label: t('automation.alerta-de-concentracion'),
        value: insights ? `${ruleNumber('REG-03_CONCENTRACION', 'umbral', 40)}%` : t('automation.desactivada-2'),
        detail: t('automation.participacion-de-un-vendedor-sobre-el-periodo'),
      },
      {
        label: t('automation.minimo-para-estadistica'),
        value: t('automation.n-datos', { n: ruleNumber('RN-40_MINIMO_DATOS', 'minimo', 2) }),
        detail: t('automation.controla-media-mediana-y-clasificacion-de-variables'),
      },
    ]
  }, [version])

  const toggle = (rule: AutomationRule) => {
    setRuleEnabled(rule.code, !rule.enabled)
    toast.show(
      rule.enabled ? 'warning' : 'success',
      rule.enabled ? t('automation.regla-desactivada') : t('automation.regla-activada'),
      rule.enabled
        ? `${t(rule.name)}: ${t('automation.el-sistema-dejara-de-aplicar-este-comportamiento')}`
        : `${t(rule.name)}: ${t('automation.se-aplicara-automaticamente-en-las-proximas-operaciones')}`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{t('automation.automatizaciones')}</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-gray-600">
            {t('automation.disena-el-comportamiento-automatico-del-sistema-activa-o-desactiva-reglas-de-negocio-y-ajusta-sus-umbrales-los-cambios-se-aplican-de-inmediato-en-todos-los-modulos')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            resetRules()
            toast.success(
              t('automation.configuracion-restablecida'),
              t('automation.las-reglas-volvieron-a-sus-valores-por-defecto'),
            )
          }}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          {t('automation.restablecer-reglas')}
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Zap aria-hidden="true" className="h-6 w-6 text-primary" />
          </span>
          <div>
            <p className="text-body-sm text-gray-600">{t('automation.reglas-automaticas')}</p>
            <p className="text-h3 font-bold text-primary">
              {activas} <span className="text-body font-normal text-gray-500">{t('automation.de-n-activas', { n: rules.length })}</span>
            </p>
          </div>
        </div>
        <div className="card">
          <p className="text-body-sm font-semibold text-gray-900">{t('automation.efecto-actual-de-la-configuracion')}</p>
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

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="automatizaciones" />

      {/* Reglas guardadas en el backend */}
      <TabPanel tabId="guardadas" active={tab === 'guardadas'}>
        <SavedRulesPanel />
      </TabPanel>

      <TabPanel tabId={tab} active={tab !== 'guardadas'}>
      {/* Reglas por módulo */}
      {modulosVisibles.map((module) => {
        const delModulo = rules.filter((rule) => rule.module === module)
        if (delModulo.length === 0) return null
        return (
          <section key={module} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={MODULE_BADGE[module]}>{t(MODULE_LABEL_KEYS[module])}</Badge>
              <span className="text-caption text-gray-500">
                {delModulo.filter((rule) => rule.enabled).length} {t('automation.de-n-activas', { n: delModulo.length })}
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
                      <h2 className="text-body font-semibold text-gray-900">{t(rule.name)}</h2>
                      <span className="font-mono text-caption text-gray-400">{rule.code}</span>
                      {!rule.enabled && <Badge variant="neutral">{t('automation.desactivada')}</Badge>}
                    </div>
                    <p className="mt-1 text-body-sm text-gray-600">{t(rule.description)}</p>

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
                      {rule.enabled ? t('automation.activa') : t('automation.inactiva')}
                    </span>
                    <Switch
                      checked={rule.enabled}
                      label={`${t(rule.enabled ? 'automation.desactivar' : 'automation.activar')} ${t(rule.name)}`}
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
        {t('automation.estas-preferencias-se-guardan-en-tu-navegador-localstorage-y-rigen-la-simulacion-de-este-modulo-el-backend-no-las-ejecuta-cuando-el-api-gestione-las-reglas-quedaran-registradas-en-la-auditoria-del-sistema-rf-22')}
      </p>
      </TabPanel>
    </div>
  )
}
