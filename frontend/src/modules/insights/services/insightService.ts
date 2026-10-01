import type { Insight, InsightSeverity } from '@/types/insight'
import {
  DEFAULT_FILTERS,
  getByCategory,
  getByProduct,
  getBySeller,
  getKpis,
  getMonthly,
  getTicketDataset,
  compareMeanMedian,
} from '@/modules/analytics/services/statisticsService'
import type { AnalyticsFilters } from '@/modules/analytics/services/statisticsService'
import { listSales } from '@/modules/sales/services/saleService'
import { listStock } from '@/modules/inventory/services/inventoryService'
import { isLowStock, ruleEnabled, ruleNumber } from '@/data/store'

/**
 * Motor de insights empresariales (Fase 11 · RF-18…RF-20).
 * Reglas determinísticas: la misma entrada produce siempre el mismo
 * insight, con su evidencia numérica y el análisis que lo origina.
 * TODO(Fase 05): el backend expondrá GET /api/v1/insights y
 * /api/v1/insights/rules (docs/05_api.md §2.10).
 */

const round2 = (value: number): number => Math.round(value * 100) / 100

let seedId = 100

/**
 * Genera los insights aplicando cada regla sobre los datos actuales.
 * @param filters filtros de analítica vigentes (periodo, vendedor, categoría)
 */
export async function generateInsights(filters: AnalyticsFilters = DEFAULT_FILTERS): Promise<Insight[]> {
  const kpis = getKpis(filters)
  const monthly = getMonthly(filters)
  const bySeller = getBySeller(filters)
  const byCategory = getByCategory(filters)
  const byProduct = getByProduct(filters)
  const compare = compareMeanMedian(getTicketDataset(filters))
  const sales = await listSales()
  const stock = await listStock()

  const insights: Array<Omit<Insight, 'id' | 'created_at' | 'read'>> = []

  // REG-01 · Tendencia de ingresos mes a mes (umbral configurable)
  const last = monthly[monthly.length - 1]
  const previous = monthly[monthly.length - 2]
  if (ruleEnabled('REG-01_TENDENCIA') && last && previous && previous.ingresos > 0) {
    const change = round2(((last.ingresos - previous.ingresos) / previous.ingresos) * 100)
    const margen = ruleNumber('REG-01_TENDENCIA', 'margen', 10)
    insights.push({
      title: change >= 0 ? 'Crecimiento de ingresos en el último mes' : 'Caída de ingresos en el último mes',
      severity: change >= margen ? 'SUCCESS' : change >= 0 ? 'INFO' : change >= -margen ? 'WARNING' : 'CRITICAL',
      rule: 'REG-01_TENDENCIA_INGRESOS',
      message: `Los ingresos de ${last.mes} fueron ${change >= 0 ? 'mayores' : 'menores'} en ${Math.abs(change)}% frente a ${previous.mes} (${formatShort(last.ingresos)} vs. ${formatShort(previous.ingresos)}). Umbral de alerta: ±${margen}%.`,
      evidence: {
        mes_actual: last.mes,
        ingresos_actual: last.ingresos,
        mes_anterior: previous.mes,
        ingresos_anterior: previous.ingresos,
        variacion_pct: change,
        umbral_pct: margen,
      },
      analysis_id: 41,
      dataset_id: 5,
    })
  }

  // REG-02 · Ticket promedio del periodo
  insights.push({
    title: 'Ticket promedio del periodo',
    severity: 'INFO',
    rule: 'REG-02_TICKET_PROMEDIO',
    message: `El ticket promedio es S/ ${kpis.ticketPromedio} sobre ${kpis.transacciones} transacciones, con ingresos de S/ ${kpis.ingresos}.`,
    evidence: {
      ticket_promedio: kpis.ticketPromedio,
      transacciones: kpis.transacciones,
      ingresos: kpis.ingresos,
      variacion_mensual_pct: kpis.variacionMensual,
    },
    analysis_id: 42,
    dataset_id: 5,
  })

  // REG-03 · Concentración de ventas por vendedor (umbral configurable)
  const topSeller = bySeller[0]
  const totalSeller = bySeller.reduce((total, row) => total + row.ingresos, 0)
  const umbral = ruleNumber('REG-03_CONCENTRACION', 'umbral', 40)
  if (ruleEnabled('REG-03_CONCENTRACION') && topSeller && totalSeller > 0) {
    const share = round2((topSeller.ingresos / totalSeller) * 100)
    insights.push({
      title: `Concentración de ventas en ${topSeller.name}`,
      severity: share >= umbral ? 'WARNING' : 'INFO',
      rule: 'REG-03_CONCENTRACION_VENDEDOR',
      message: `${topSeller.name} concentra el ${share}% de los ingresos del periodo${share >= umbral ? `, por encima del umbral configurado del ${umbral}%` : `, por debajo del umbral configurado del ${umbral}%`}.`,
      evidence: {
        vendedor: topSeller.name,
        ingresos: topSeller.ingresos,
        participación_pct: share,
        umbral_pct: umbral,
      },
      analysis_id: 43,
      dataset_id: 6,
    })
  }

  // REG-04 · Concentración por categoría
  const topCategory = byCategory[0]
  const totalCategory = byCategory.reduce((total, row) => total + row.ingresos, 0)
  if (topCategory && totalCategory > 0) {
    const share = round2((topCategory.ingresos / totalCategory) * 100)
    insights.push({
      title: `Categoría líder: ${topCategory.name}`,
      severity: 'INFO',
      rule: 'REG-04_CONCENTRACION_CATEGORIA',
      message: `${topCategory.name} aporta el ${share}% de los ingresos del periodo.`,
      evidence: {
        categoría: topCategory.name,
        ingresos: topCategory.ingresos,
        participación_pct: share,
      },
      analysis_id: 44,
      dataset_id: 7,
    })
  }

  // REG-05 · Asimetría de la distribución (cola derecha)
  insights.push({
    title:
      Math.abs(compare.differencePct) < 5
        ? 'Distribución simétrica de tickets'
        : compare.difference > 0
          ? 'Cola derecha: pocas ventas elevan el promedio'
          : 'Cola izquierda: muchas ventas pequeñas bajan el promedio',
    severity: Math.abs(compare.differencePct) < 5 ? 'INFO' : 'WARNING',
    rule: 'REG-05_ASIMETRIA_DISTRIBUCION',
    message: `${compare.interpretation} Media S/ ${round2(compare.mean)} vs. mediana S/ ${round2(compare.median)} (${compare.differencePct}%).`,
    evidence: {
      media: round2(compare.mean),
      mediana: round2(compare.median),
      diferencia: compare.difference,
      diferencia_pct: compare.differencePct,
    },
    analysis_id: 45,
    dataset_id: 5,
  })

  // REG-06 · Cobranza pendiente
  const pending = sales.filter((sale) => sale.status === 'pending' || sale.status === 'partial')
  const pendingAmount = pending.reduce((total, sale) => total + sale.balance, 0)
  insights.push({
    title:
      pending.length === 0
        ? 'Sin ventas pendientes de cobro'
        : `${pending.length} venta(s) con saldo pendiente`,
    severity: pending.length === 0 ? 'SUCCESS' : pendingAmount > 200 ? 'WARNING' : 'INFO',
    rule: 'REG-06_COBRANZA_PENDIENTE',
    message:
      pending.length === 0
        ? 'Todas las ventas registradas están pagadas.'
        : `El saldo por cobrar suma S/ ${round2(pendingAmount)} en ${pending.length} venta(s).`,
    evidence: {
      ventas_pendientes: pending.length,
      saldo_por_cobrar: round2(pendingAmount),
    },
    analysis_id: null,
    dataset_id: 8,
  })

  // REG-07 · Stock bajo o agotado (regla configurable)
  if (ruleEnabled('REG-07_STOCK_INSIGHT')) {
    const alerts = stock.filter((row) => isLowStock(row))
    const outOfStock = stock.filter((row) => row.current_stock === 0)
    insights.push({
      title: outOfStock.length > 0 ? 'Productos sin stock' : 'Alertas de stock bajo',
      severity: outOfStock.length > 0 ? 'CRITICAL' : alerts.length > 0 ? 'WARNING' : 'SUCCESS',
      rule: 'REG-07_STOCK_BAJO',
      message:
        alerts.length === 0
          ? 'Todos los productos están por encima del umbral de alerta configurado.'
          : `${alerts.length} producto(s) en alerta según el umbral configurado, de los cuales ${outOfStock.length} están agotados.`,
      evidence: {
        productos_en_alerta: alerts.length,
        productos_sin_stock: outOfStock.length,
        skus: alerts.slice(0, 5).map((row) => row.sku).join(', '),
      },
      analysis_id: null,
      dataset_id: 9,
    })
  }

  // REG-08 · Producto con mayor facturación
  const topProduct = byProduct[0]
  if (topProduct) {
    insights.push({
      title: `Producto estrella: ${topProduct.name}`,
      severity: 'SUCCESS',
      rule: 'REG-08_PRODUCTO_ESTRELLA',
      message: `${topProduct.name} lidera la facturación con S/ ${topProduct.ingresos} (${topProduct.unidades} unidades).`,
      evidence: {
        producto: topProduct.name,
        ingresos: topProduct.ingresos,
        unidades: topProduct.unidades,
      },
      analysis_id: 46,
      dataset_id: 10,
    })
  }

  const now = Date.now()
  return insights.map((insight, index) => ({
    ...insight,
    id: ++seedId,
    created_at: new Date(now - index * 3600_000).toISOString(),
    read: index > 2,
  }))
}

function formatShort(value: number): string {
  return `S/ ${Math.round(value).toLocaleString('es-PE')}`
}

export interface InsightFilters {
  severity: InsightSeverity | ''
  search: string
}

export function filterInsights(insights: Insight[], filters: InsightFilters): Insight[] {
  const term = filters.search.trim().toLowerCase()
  return insights.filter(
    (insight) =>
      (!filters.severity || insight.severity === filters.severity) &&
      (term === '' ||
        insight.title.toLowerCase().includes(term) ||
        insight.message.toLowerCase().includes(term) ||
        insight.rule.toLowerCase().includes(term)),
  )
}

/**
 * Reglas determinísticas evaluadas, con su estado y umbrales actuales.
 * La página de Automatizaciones es quien las configura.
 */
export function getActiveRules(): Array<{
  code: string
  description: string
  severity: InsightSeverity
  enabled: boolean
  automationCode: string
}> {
  return INSIGHT_RULES.map((rule) => ({
    ...rule,
    enabled: rule.automationCode ? ruleEnabled(rule.automationCode) : true,
  }))
}

/** Reglas vigentes que el sistema evalúa (GET /api/v1/insights/rules). */
export const INSIGHT_RULES: Array<{
  code: string
  description: string
  severity: InsightSeverity
  automationCode: string
}> = [
  { code: 'REG-01_TENDENCIA_INGRESOS', description: 'Compara los ingresos del último mes con el anterior.', severity: 'INFO', automationCode: 'REG-01_TENDENCIA' },
  { code: 'REG-02_TICKET_PROMEDIO', description: 'Calcula el ticket promedio del periodo filtrado.', severity: 'INFO', automationCode: '' },
  { code: 'REG-03_CONCENTRACION_VENDEDOR', description: 'Detecta concentración de ingresos por vendedor.', severity: 'WARNING', automationCode: 'REG-03_CONCENTRACION' },
  { code: 'REG-04_CONCENTRACION_CATEGORIA', description: 'Identifica la categoría con mayor participación.', severity: 'INFO', automationCode: '' },
  { code: 'REG-05_ASIMETRIA_DISTRIBUCION', description: 'Compara media y mediana para detectar colas asimétricas.', severity: 'WARNING', automationCode: '' },
  { code: 'REG-06_COBRANZA_PENDIENTE', description: 'Suma el saldo de ventas pendientes o parciales.', severity: 'WARNING', automationCode: '' },
  { code: 'REG-07_STOCK_BAJO', description: 'Detecta productos en o por debajo del umbral de stock.', severity: 'CRITICAL', automationCode: 'REG-07_STOCK_INSIGHT' },
  { code: 'REG-08_PRODUCTO_ESTRELLA', description: 'Rankea el producto con mayor facturación.', severity: 'SUCCESS', automationCode: '' },
]
