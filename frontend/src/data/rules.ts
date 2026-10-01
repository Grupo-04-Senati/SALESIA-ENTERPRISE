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
    name: 'Bloquear venta sin stock',
    description:
      'Antes de registrar la venta verifica que exista stock suficiente de cada producto y rechaza la operación si no alcanza.',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-11_TOTALES',
    name: 'Calcular totales e IGV automático',
    description:
      'Calcula subtotal, descuento, impuesto y total de cada venta con la tasa configurada, sin intervención manual.',
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
    name: 'Impedir pago mayor al total',
    description: 'Rechaza el pago cuando el monto cobrado supera el total de la venta.',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-08_STOCK_AUTOMATICO',
    name: 'Descontar stock y generar kardex',
    description:
      'Al confirmar la venta descuenta el stock de cada línea y registra el movimiento de salida en el kardex.',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-07_HISTORIAL_CLIENTE',
    name: 'Actualizar historial del cliente',
    description:
      'Suma la venta al historial y al total acumulado del cliente, y clasifica su estado de pago.',
    module: 'Ventas',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-09_INDICADORES',
    name: 'Recalcular indicadores',
    description:
      'Actualiza Dashboard, Analytics, Insights y Reportes con la venta recién registrada.',
    module: 'Ventas',
    enabled: true,
    params: [],
  },

  /* --------------------------- Inventario -------------------------- */
  {
    code: 'RN-20_STOCK_NEGATIVO',
    name: 'Nunca permitir stock negativo',
    description: 'Bloquea salidas, mermas y ajustes que dejen el stock por debajo de cero.',
    module: 'Inventario',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-21_MOTIVO_MERMA',
    name: 'Exigir motivo en merma y ajuste',
    description: 'No permite registrar mermas ni ajustes sin un motivo escrito.',
    module: 'Inventario',
    enabled: true,
    params: [],
  },
  {
    code: 'ALERTA_STOCK',
    name: 'Alerta de stock bajo',
    description:
      'Marca los productos cuyo stock iguala o supera por poco el mínimo, y los muestra en el panel de alertas.',
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
    name: 'Documento único por cliente',
    description: 'Impide registrar dos clientes con el mismo número de documento.',
    module: 'Clientes',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-03_SKU_UNICO',
    name: 'SKU único de producto',
    description: 'Impide registrar dos productos con el mismo SKU.',
    module: 'Productos',
    enabled: true,
    params: [],
  },
  {
    code: 'RN-05_PRECIO_VENTA',
    name: 'Precio de venta ≥ costo',
    description: 'Rechaza productos cuyo precio de venta sea menor al costo.',
    module: 'Productos',
    enabled: true,
    params: [],
  },

  /* --------------------------- Analítica --------------------------- */
  {
    code: 'REG-03_CONCENTRACION',
    name: 'Alerta de concentración de ventas',
    description:
      'Genera un insight de alerta cuando un vendedor concentra demasiados ingresos del periodo.',
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
    name: 'Alerta de variación mensual',
    description:
      'Genera un insight cuando la variación de ingresos de un mes supera el margen definido.',
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
    name: 'Insight de stock bajo',
    description: 'Genera el insight de productos agotados o por debajo del mínimo.',
    module: 'Analítica',
    enabled: true,
    params: [],
  },

  /* -------------------------- Probabilidad ------------------------- */
  {
    code: 'RN-40_MINIMO_DATOS',
    name: 'Mínimo de observaciones',
    description:
      'Exige al menos esta cantidad de datos para calcular media, mediana o clasificar una variable.',
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
    name: 'Bloquear Bayes con P(B) = 0',
    description: 'No permite calcular el posterior cuando la evidencia es cero (resultado indefinido).',
    module: 'Probabilidad',
    enabled: true,
    params: [],
  },
  {
    code: 'RF-21_HISTORIAL',
    name: 'Registrar historial de análisis',
    description: 'Guarda cada cálculo realizado en el módulo para poder consultarlo después.',
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
