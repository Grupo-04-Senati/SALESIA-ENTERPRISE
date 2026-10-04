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

/** Traductor i18n (clave → texto) inyectado desde `useLang()`. */
export type Translator = (key: string, params?: Record<string, string | number>) => string

let seedId = 100

/**
 * Genera los insights aplicando cada regla sobre los datos actuales.
 * @param filters filtros de analítica vigentes (periodo, vendedor, categoría)
 * @param t traductor i18n; si se omite, se devuelven las claves sin traducir
 */
export async function generateInsights(
  filters: AnalyticsFilters = DEFAULT_FILTERS,
  t: Translator = (key) => key,
): Promise<Insight[]> {
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
    const params = {
      mes: last.mes,
      variacion: Math.abs(change),
      mesAnterior: previous.mes,
      actual: formatShort(last.ingresos),
      anterior: formatShort(previous.ingresos),
      umbral: margen,
    }
    insights.push({
      title:
        change >= 0
          ? t('insights.titulo-crecimiento-ingresos')
          : t('insights.titulo-caida-ingresos'),
      severity: change >= margen ? 'SUCCESS' : change >= 0 ? 'INFO' : change >= -margen ? 'WARNING' : 'CRITICAL',
      rule: 'REG-01_TENDENCIA_INGRESOS',
      message:
        change >= 0
          ? t('insights.mensaje-tendencia-positiva', params)
          : t('insights.mensaje-tendencia-negativa', params),
      evidence: {
        mes_actual: last.mes,
        ingresos_actual: last.ingresos,
        mes_anterior: previous.mes,
        ingresos_anterior: previous.ingresos,
        variacion_pct: change,
        umbral_pct: margen,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-02 · Ticket promedio del periodo (solo con ventas reales)
  if (kpis.transacciones > 0) {
    insights.push({
      title: t('insights.titulo-ticket-promedio'),
      severity: 'INFO',
      rule: 'REG-02_TICKET_PROMEDIO',
      message: t('insights.mensaje-ticket-promedio', {
        ticket: kpis.ticketPromedio,
        transacciones: kpis.transacciones,
        ingresos: kpis.ingresos,
      }),
      evidence: {
        ticket_promedio: kpis.ticketPromedio,
        transacciones: kpis.transacciones,
        ingresos: kpis.ingresos,
        variacion_mensual_pct: kpis.variacionMensual,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-03 · Concentración de ventas por vendedor (umbral configurable)
  const topSeller = bySeller[0]
  const totalSeller = bySeller.reduce((total, row) => total + row.ingresos, 0)
  const umbral = ruleNumber('REG-03_CONCENTRACION', 'umbral', 40)
  if (ruleEnabled('REG-03_CONCENTRACION') && topSeller && totalSeller > 0) {
    const share = round2((topSeller.ingresos / totalSeller) * 100)
    insights.push({
      title: t('insights.titulo-concentracion-vendedor', { vendedor: topSeller.name }),
      severity: share >= umbral ? 'WARNING' : 'INFO',
      rule: 'REG-03_CONCENTRACION_VENDEDOR',
      message: t(
        share >= umbral ? 'insights.mensaje-concentracion-alta' : 'insights.mensaje-concentracion-baja',
        { vendedor: topSeller.name, participacion: share, umbral },
      ),
      evidence: {
        vendedor: topSeller.name,
        ingresos: topSeller.ingresos,
        participación_pct: share,
        umbral_pct: umbral,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-04 · Concentración por categoría
  const topCategory = byCategory[0]
  const totalCategory = byCategory.reduce((total, row) => total + row.ingresos, 0)
  if (topCategory && totalCategory > 0) {
    const share = round2((topCategory.ingresos / totalCategory) * 100)
    insights.push({
      title: t('insights.titulo-categoria-lider', { categoria: topCategory.name }),
      severity: 'INFO',
      rule: 'REG-04_CONCENTRACION_CATEGORIA',
      message: t('insights.mensaje-categoria-lider', {
        categoria: topCategory.name,
        participacion: share,
      }),
      evidence: {
        categoría: topCategory.name,
        ingresos: topCategory.ingresos,
        participación_pct: share,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-05 · Asimetría de la distribución (requiere tickets reales)
  if (getTicketDataset(filters).length >= 2) {
    insights.push({
      title:
        Math.abs(compare.differencePct) < 5
          ? t('insights.titulo-distribucion-simetrica')
          : compare.difference > 0
            ? t('insights.titulo-cola-derecha')
            : t('insights.titulo-cola-izquierda'),
      severity: Math.abs(compare.differencePct) < 5 ? 'INFO' : 'WARNING',
      rule: 'REG-05_ASIMETRIA_DISTRIBUCION',
      message: t('insights.mensaje-asimetria', {
        interpretacion: t(compare.interpretation),
        media: round2(compare.mean),
        mediana: round2(compare.median),
        pct: compare.differencePct,
      }),
      evidence: {
        media: round2(compare.mean),
        mediana: round2(compare.median),
        diferencia: compare.difference,
        diferencia_pct: compare.differencePct,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-06 · Cobranza pendiente (solo con ventas registradas)
  const pending = sales.filter((sale) => sale.status === 'pending' || sale.status === 'partial')
  const pendingAmount = pending.reduce((total, sale) => total + sale.balance, 0)
  if (sales.length > 0) {
    insights.push({
      title:
        pending.length === 0
          ? t('insights.titulo-sin-pendientes')
          : t('insights.titulo-ventas-saldo-pendiente', { n: pending.length }),
      severity: pending.length === 0 ? 'SUCCESS' : pendingAmount > 200 ? 'WARNING' : 'INFO',
      rule: 'REG-06_COBRANZA_PENDIENTE',
      message:
        pending.length === 0
          ? t('insights.mensaje-todas-pagadas')
          : t('insights.mensaje-saldo-pendiente', {
              saldo: round2(pendingAmount),
              n: pending.length,
            }),
      evidence: {
        ventas_pendientes: pending.length,
        saldo_por_cobrar: round2(pendingAmount),
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-07 · Stock bajo o agotado (regla configurable; requiere catálogo)
  if (ruleEnabled('REG-07_STOCK_INSIGHT') && stock.length > 0) {
    const alerts = stock.filter((row) => isLowStock(row))
    const outOfStock = stock.filter((row) => row.current_stock === 0)
    insights.push({
      title: outOfStock.length > 0 ? t('insights.productos-sin-stock') : t('insights.titulo-alertas-stock-bajo'),
      severity: outOfStock.length > 0 ? 'CRITICAL' : alerts.length > 0 ? 'WARNING' : 'SUCCESS',
      rule: 'REG-07_STOCK_BAJO',
      message:
        alerts.length === 0
          ? t('insights.mensaje-stock-ok')
          : t('insights.mensaje-stock-alerta', { n: alerts.length, agotados: outOfStock.length }),
      evidence: {
        productos_en_alerta: alerts.length,
        productos_sin_stock: outOfStock.length,
        skus: alerts.slice(0, 5).map((row) => row.sku).join(', '),
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  // REG-08 · Producto con mayor facturación
  const topProduct = byProduct[0]
  if (topProduct) {
    insights.push({
      title: t('insights.titulo-producto-estrella', { producto: topProduct.name }),
      severity: 'SUCCESS',
      rule: 'REG-08_PRODUCTO_ESTRELLA',
      message: t('insights.mensaje-producto-estrella', {
        producto: topProduct.name,
        ingresos: topProduct.ingresos,
        unidades: topProduct.unidades,
      }),
      evidence: {
        producto: topProduct.name,
        ingresos: topProduct.ingresos,
        unidades: topProduct.unidades,
      },
      analysis_id: null,
      dataset_id: null,
    })
  }

  if (insights.length === 0) {
    insights.push({
      title: t('insights.titulo-sin-datos'),
      severity: 'INFO',
      rule: 'REG-02_TICKET_PROMEDIO',
      message: t('insights.mensaje-sin-datos'),
      evidence: {},
      analysis_id: null,
      dataset_id: null,
    })
  }

  const now = Date.now()
  return insights.map((insight) => ({
    ...insight,
    id: ++seedId,
    created_at: new Date(now).toISOString(),
    read: false,
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
  { code: 'REG-01_TENDENCIA_INGRESOS', description: 'insights.regla-desc-01', severity: 'INFO', automationCode: 'REG-01_TENDENCIA' },
  { code: 'REG-02_TICKET_PROMEDIO', description: 'insights.regla-desc-02', severity: 'INFO', automationCode: '' },
  { code: 'REG-03_CONCENTRACION_VENDEDOR', description: 'insights.regla-desc-03', severity: 'WARNING', automationCode: 'REG-03_CONCENTRACION' },
  { code: 'REG-04_CONCENTRACION_CATEGORIA', description: 'insights.regla-desc-04', severity: 'INFO', automationCode: '' },
  { code: 'REG-05_ASIMETRIA_DISTRIBUCION', description: 'insights.regla-desc-05', severity: 'WARNING', automationCode: '' },
  { code: 'REG-06_COBRANZA_PENDIENTE', description: 'insights.regla-desc-06', severity: 'WARNING', automationCode: '' },
  { code: 'REG-07_STOCK_BAJO', description: 'insights.regla-desc-07', severity: 'CRITICAL', automationCode: 'REG-07_STOCK_INSIGHT' },
  { code: 'REG-08_PRODUCTO_ESTRELLA', description: 'insights.regla-desc-08', severity: 'SUCCESS', automationCode: '' },
]
