/**
 * Automatizaciones del sistema (Fase 06 · RF-13, RN-01…RN-47).
 *
 * Cada regla define un comportamiento automático: validaciones de negocio,
 * actualización de stock, recálculo de indicadores y umbrales de alerta.
 * Todas se pueden activar, desactivar o ajustar desde el frontend en la
 * página de Automatizaciones, y el sistema las aplica en el momento.
 *
 * TODO(Fase 05): el backend evaluará las mismas reglas (docs/06_reglas.md
 * y RN-* de docs/05_api.md); el frontend las expone para revisarlas y
 * configurarlas.
 */

export type RuleModule = 'Ventas' | 'Inventario' | 'Clientes' | 'Productos' | 'Analítica' | 'Probabilidad'

export interface RuleParam {
  key: string
  label: string
  type: 'number' | 'boolean'
  value: number | boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  help?: string
}

export interface AutomationRule {
  /** Código de la regla (RN-xx del plan / RF-xx de los requisitos). */
  code: string
  name: string
  description: string
  module: RuleModule
  enabled: boolean
  params: RuleParam[]
}

export const DEFAULT_RULES: AutomationRule[] = [
  /* ---------------------------- Ventas ---------------------------- */
  {
    code: 'RN-10_STOCK_INSUFICIENTE',
    name: 'automation.regla-bloquear-venta-sin-stock',
    description:
      'automation.regla-bloquear-venta-sin-stock-desc',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-11_TOTALES',
    name: 'automation.regla-calcular-totales-igv',
    description:
      'automation.regla-calcular-totales-igv-desc',
    module: 'Ventas',
    enabled: true,
    params: [
      {
        key: 'taxRate',
        label: 'Tasa de impuesto',
        type: 'number',
        value: 18,
        min: 0,
        max: 50,
        step: 0.5,
        unit: '%',
        help: 'IGV aplicado a (subtotal − descuento).',
      },
    ],
  },
  {
    code: 'RN-16_PAGO_MAXIMO',
    name: 'automation.regla-impedir-pago-mayor',
    description: 'automation.regla-impedir-pago-mayor-desc',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-08_STOCK_AUTOMATICO',
    name: 'automation.regla-descontar-stock-kardex',
    description:
      'automation.regla-descontar-stock-kardex-desc',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-07_HISTORIAL_CLIENTE',
    name: 'automation.regla-actualizar-historial-cliente',
    description:
      'automation.regla-actualizar-historial-cliente-desc',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-09_INDICADORES',
    name: 'automation.regla-recalcular-indicadores',
    description:
      'automation.regla-recalcular-indicadores-desc',
    module: 'Ventas',
    enabled: true,
    params: [],
  },

  /* --------------------------- Inventario -------------------------- */
  {
    code: 'RN-20_STOCK_NEGATIVO',
    name: 'automation.regla-nunca-stock-negativo',
    description: 'automation.regla-nunca-stock-negativo-desc',
    module: 'Inventario',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-21_MOTIVO_MERMA',
    name: 'automation.regla-exigir-motivo-merma',
    description: 'automation.regla-exigir-motivo-merma-desc',
    module: 'Inventario',
    enabled: true,
    params: [],
  },
  {
    code: 'ALERTA_STOCK',
    name: 'automation.regla-alerta-stock-bajo',
    description:
      'automation.regla-alerta-stock-bajo-desc',
    module: 'Inventario',
    enabled: true,
    params: [
      {
        key: 'factor',
        label: 'Umbral sobre el mínimo',
        type: 'number',
        value: 100,
        min: 100,
        max: 300,
        step: 10,
        unit: '%',
        help: '100% = alerta cuando stock ≤ mínimo. 150% = alerta hasta 1,5× el mínimo.',
      },
    ],
  },

  /* ------------------------ Clientes y Productos -------------------- */
  {
    code: 'RN-01_DOCUMENTO_UNICO',
    name: 'automation.regla-documento-unico',
    description: 'automation.regla-documento-unico-desc',
    module: 'Clientes',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-03_SKU_UNICO',
    name: 'automation.regla-sku-unico',
    description: 'automation.regla-sku-unico-desc',
    module: 'Productos',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-05_PRECIO_VENTA',
    name: 'automation.regla-precio-venta-costo',
    description: 'automation.regla-precio-venta-costo-desc',
    module: 'Productos',
    enabled: true,
    params: [],
  },

  /* --------------------------- Analítica --------------------------- */
  {
    code: 'REG-03_CONCENTRACION',
    name: 'automation.regla-alerta-concentracion-ventas',
    description:
      'automation.regla-alerta-concentracion-ventas-desc',
    module: 'Analítica',
    enabled: true,
    params: [
      {
        key: 'umbral',
        label: 'Umbral de participación',
        type: 'number',
        value: 40,
        min: 10,
        max: 90,
        step: 5,
        unit: '%',
        help: 'Participación de un vendedor sobre el total del periodo.',
      },
    ],
  },
  {
    code: 'REG-01_TENDENCIA',
    name: 'automation.regla-alerta-variacion-mensual',
    description:
      'automation.regla-alerta-variacion-mensual-desc',
    module: 'Analítica',
    enabled: true,
    params: [
      {
        key: 'margen',
        label: 'Margen de variación',
        type: 'number',
        value: 10,
        min: 1,
        max: 50,
        step: 1,
        unit: '%',
        help: 'Variación mínima contra el mes anterior para marcar alerta.',
      },
    ],
  },
  {
    code: 'REG-07_STOCK_INSIGHT',
    name: 'automation.regla-insight-stock-bajo',
    description: 'automation.regla-insight-stock-bajo-desc',
    module: 'Analítica',
    enabled: true,
    params: [],
  },

  /* -------------------------- Probabilidad ------------------------- */
  {
    code: 'RN-40_MINIMO_DATOS',
    name: 'automation.regla-minimo-observaciones',
    description:
      'automation.regla-minimo-observaciones-desc',
    module: 'Probabilidad',
    enabled: true,
    params: [
      {
        key: 'minimo',
        label: 'Observaciones mínimas',
        type: 'number',
        value: 2,
        min: 2,
        max: 30,
        step: 1,
        unit: 'datos',
      },
    ],
  },
  {
    code: 'RN-43_BAYES_CERO',
    name: 'automation.regla-bloquear-bayes-pb0',
    description: 'automation.regla-bloquear-bayes-pb0-desc',
    module: 'Probabilidad',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-21_HISTORIAL',
    name: 'automation.regla-registrar-historial-analisis',
    description: 'automation.regla-registrar-historial-analisis-desc',
    module: 'Probabilidad',
    enabled: true,
    params: [],
  },
]

/** Reglas agrupadas por módulo para la página de Automatizaciones. */
export const RULE_MODULES: RuleModule[] = [
  'Ventas',
  'Inventario',
  'Clientes',
  'Productos',
  'Analítica',
  'Probabilidad',
]
