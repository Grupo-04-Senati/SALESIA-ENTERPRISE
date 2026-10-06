import type { Sale } from '@/types/sale'
import { listSales } from '@/modules/sales/services/saleService'
import { listProducts } from '@/modules/products/services/productService'
import { listCustomers } from '@/modules/customers/services/customerService'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/formatters'
import { getBySeller, getDistribution, getKpis, getMonthly, getTicketDataset, compareMeanMedian } from '@/modules/analytics/services/statisticsService'

/**
 * Módulo de reportes (Fase 12 · RF-20): reporte de ventas, estadístico,
 * de productos, de clientes y de vendedores, con exportación CSV y
 * vista imprimible.
 * TODO(Fase 05): POST /api/v1/reports y /reports/{id}/export generarán
 * el archivo en el backend (docs/05_api.md §2.10).
 */

/** Traductor i18n (clave → texto) inyectado desde `useLang()`. */
export type Translator = (key: string, params?: Record<string, string | number>) => string

export const REPORT_TYPES = [
  { value: 'ventas', label: 'reports.tipo-ventas', description: 'reports.tipo-ventas-desc' },
  { value: 'estadistico', label: 'reports.tipo-estadistico', description: 'reports.tipo-estadistico-desc' },
  { value: 'productos', label: 'reports.tipo-productos', description: 'reports.tipo-productos-desc' },
  { value: 'clientes', label: 'reports.tipo-clientes', description: 'reports.tipo-clientes-desc' },
  { value: 'vendedores', label: 'reports.tipo-vendedores', description: 'reports.tipo-vendedores-desc' },
] as const

export type ReportType = (typeof REPORT_TYPES)[number]['value']

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface ReportRow {
  [key: string]: string | number
}

export interface Report {
  type: ReportType
  title: string
  description: string
  generated_at: string
  columns: ReportColumn[]
  rows: ReportRow[]
  summary: Array<{ label: string; value: string }>
}

const money = (value: number): string => formatCurrency(value)
const round2 = (value: number): number => Math.round(value * 100) / 100

export async function generateReport(type: ReportType, t: Translator): Promise<Report> {
  const generated_at = new Date().toISOString()

  if (type === 'ventas') {
    const sales = await listSales()
    const rows: ReportRow[] = sales.map((sale) => ({
      venta: sale.sale_number,
      fecha: formatDate(sale.issued_at),
      cliente: sale.customer.name,
      vendedor: sale.seller.name,
      estado: sale.status,
      subtotal: sale.subtotal,
      descuento: sale.discount,
      impuesto: sale.tax,
      total: sale.total,
      pagado: sale.paid,
      saldo: sale.balance,
    }))
    const válidas = sales.filter((sale) => sale.status !== 'cancelled')
    return {
      type,
      title: t('reports.tipo-ventas'),
      description: t('reports.descripcion-ventas'),
      generated_at,
      columns: [
        { key: 'venta', label: t('reports.col-venta') },
        { key: 'fecha', label: t('reports.col-fecha') },
        { key: 'cliente', label: t('reports.col-cliente') },
        { key: 'vendedor', label: t('reports.col-vendedor') },
        { key: 'estado', label: t('reports.col-estado') },
        { key: 'total', label: t('reports.col-total'), align: 'right' },
        { key: 'saldo', label: t('reports.col-saldo'), align: 'right' },
      ],
      rows,
      summary: [
        { label: t('reports.ventas-registradas'), value: formatNumber(sales.length) },
        { label: t('reports.ventas-validas'), value: formatNumber(válidas.length) },
        {
          label: t('reports.ingresos-totales'),
          value: money(válidas.reduce((total, sale) => total + sale.total, 0)),
        },
        {
          label: t('reports.saldo-por-cobrar'),
          value: money(sales.reduce((total, sale) => total + sale.balance, 0)),
        },
      ],
    }
  }

  if (type === 'estadistico') {
    const kpis = getKpis({ months: 12, seller: '', category: '' })
    const dataset = getTicketDataset({ months: 12, seller: '', category: '' })
    const compare = compareMeanMedian(dataset)
    const sinVentas = dataset.length === 0
    // Moda: ticket que más se repite; si todos son distintos → "Sin repetición".
    const frecuencias = new Map<number, number>()
    for (const ticket of dataset) {
      const key = round2(ticket)
      frecuencias.set(key, (frecuencias.get(key) ?? 0) + 1)
    }
    let modaValue: number | string = '—'
    let modaCount = 0
    frecuencias.forEach((count, value) => {
      if (count > modaCount) {
        modaCount = count
        modaValue = value
      }
    })
    if (!sinVentas && modaCount < 2) modaValue = 'Sin repetición'
    const rows: ReportRow[] = [
      { indicador: t('reports.ind-ingresos-periodo'), valor: kpis.ingresos, unidad: 'S/' },
      { indicador: t('reports.ind-transacciones'), valor: kpis.transacciones, unidad: 'uds' },
      { indicador: t('reports.ind-ticket-promedio'), valor: kpis.ticketPromedio, unidad: 'S/' },
      { indicador: t('reports.ind-media-tickets'), valor: sinVentas ? '—' : round2(compare.mean), unidad: 'S/' },
      { indicador: t('reports.ind-mediana-tickets'), valor: sinVentas ? '—' : round2(compare.median), unidad: 'S/' },
      { indicador: 'Moda de tickets', valor: modaValue, unidad: typeof modaValue === 'number' ? 'S/' : '—' },
      { indicador: t('reports.ind-diferencia-media-mediana'), valor: sinVentas ? '—' : compare.difference, unidad: 'S/' },
      { indicador: t('reports.ind-variacion-mensual'), valor: kpis.variacionMensual, unidad: '%' },
      { indicador: t('reports.ind-minimo-ticket'), valor: sinVentas ? '—' : Math.min(...dataset), unidad: 'S/' },
      { indicador: t('reports.ind-maximo-ticket'), valor: sinVentas ? '—' : Math.max(...dataset), unidad: 'S/' },
    ]
    return {
      type,
      title: t('reports.tipo-estadistico'),
      description: t('reports.descripcion-estadistico'),
      generated_at,
      columns: [
        { key: 'indicador', label: t('reports.col-indicador') },
        { key: 'valor', label: t('reports.col-valor'), align: 'right' },
        { key: 'unidad', label: t('reports.col-unidad') },
      ],
      rows,
      summary: [
        { label: t('reports.observaciones-analizadas'), value: formatNumber(dataset.length) },
        {
          label: t('reports.interpretacion'),
          value: sinVentas
            ? t('reports.sin-ventas-interpretacion')
            : t(compare.interpretation),
        },
        { label: t('reports.meses-incluidos'), value: '12' },
      ],
    }
  }

  if (type === 'productos') {
    const products = await listProducts()
    const rows: ReportRow[] = products.map((product) => ({
      sku: product.sku,
      producto: product.name,
      categoria: product.category?.name ?? '—',
      costo: product.cost_price,
      precio: product.sale_price,
      margen: round2(((product.sale_price - product.cost_price) / Math.max(product.sale_price, 1)) * 100),
      stock: product.current_stock,
      minimo: product.min_stock,
      estado: product.status,
    }))
    return {
      type,
      title: t('reports.tipo-productos'),
      description: t('reports.descripcion-productos'),
      generated_at,
      columns: [
        { key: 'sku', label: t('reports.col-sku') },
        { key: 'producto', label: t('reports.col-producto') },
        { key: 'categoria', label: t('reports.col-categoria') },
        { key: 'precio', label: t('reports.col-precio'), align: 'right' },
        { key: 'margen', label: t('reports.col-margen-pct'), align: 'right' },
        { key: 'stock', label: t('reports.col-stock'), align: 'right' },
        { key: 'estado', label: t('reports.col-estado') },
      ],
      rows,
      summary: [
        { label: t('reports.productos-activos'), value: formatNumber(products.filter((p) => p.status === 'active').length) },
        { label: t('reports.productos-en-alerta'), value: formatNumber(products.filter((p) => p.current_stock <= p.min_stock).length) },
        {
          label: t('reports.valor-inventario-costo'),
          value: money(products.reduce((total, product) => total + product.cost_price * product.current_stock, 0)),
        },
      ],
    }
  }

  if (type === 'clientes') {
    const customers = await listCustomers()
    const rows: ReportRow[] = customers.map((customer) => ({
      cliente: customer.name,
      documento: `${customer.document_type} ${customer.document_number}`,
      segmento: customer.segment,
      compras: customer.purchase_count,
      total_comprado: customer.total_purchased,
      ticket_promedio:
        customer.purchase_count > 0 ? round2(customer.total_purchased / customer.purchase_count) : 0,
      estado: customer.status,
    }))
    return {
      type,
      title: t('reports.tipo-clientes'),
      description: t('reports.descripcion-clientes'),
      generated_at,
      columns: [
        { key: 'cliente', label: t('reports.col-cliente') },
        { key: 'documento', label: t('reports.col-documento') },
        { key: 'segmento', label: t('reports.col-segmento') },
        { key: 'compras', label: t('reports.col-compras'), align: 'right' },
        { key: 'total_comprado', label: t('reports.col-total-comprado'), align: 'right' },
        { key: 'ticket_promedio', label: t('reports.col-ticket-prom'), align: 'right' },
        { key: 'estado', label: t('reports.col-estado') },
      ],
      rows,
      summary: [
        { label: t('reports.clientes'), value: formatNumber(customers.length) },
        { label: t('reports.clientes-activos'), value: formatNumber(customers.filter((c) => c.status === 'active').length) },
        {
          label: t('reports.facturacion-acumulada'),
          value: money(customers.reduce((total, customer) => total + customer.total_purchased, 0)),
        },
      ],
    }
  }

  // vendedores
  const sales = await listSales()
  const bySeller = getBySeller({ months: 12, seller: '', category: '' })
  const rows: ReportRow[] = bySeller.map((seller) => {
    const propias = sales.filter((sale) => sale.seller.name === seller.name && sale.status !== 'cancelled')
    const total = propias.reduce((sum, sale) => sum + sale.total, 0)
    return {
      vendedor: seller.name,
      ventas: propias.length,
      ingresos: total,
      ticket_promedio: propias.length > 0 ? round2(total / propias.length) : 0,
      participación: bySeller.length > 0 ? Math.round((total / Math.max(bySeller.reduce((s, row) => s + row.ingresos, 0), 1)) * 1000) / 10 : 0,
      estado: propias.some((sale) => sale.status !== 'paid') ? t('reports.con-saldos') : t('reports.al-dia'),
    }
  })
  return {
    type: 'vendedores',
    title: t('reports.tipo-vendedores'),
    description: t('reports.descripcion-vendedores'),
    generated_at,
    columns: [
      { key: 'vendedor', label: t('reports.col-vendedor') },
      { key: 'ventas', label: t('reports.col-ventas'), align: 'right' },
      { key: 'ingresos', label: t('reports.col-ingresos'), align: 'right' },
      { key: 'ticket_promedio', label: t('reports.col-ticket-prom'), align: 'right' },
      { key: 'participación', label: t('reports.col-participacion-pct'), align: 'right' },
      { key: 'estado', label: t('reports.col-estado') },
    ],
    rows,
    summary: [
      { label: t('reports.vendedores'), value: formatNumber(bySeller.length) },
      { label: t('reports.ingresos-atribuidos'), value: money(bySeller.reduce((total, seller) => total + seller.ingresos, 0)) },
      { label: t('reports.vendedores-con-saldos'), value: formatNumber(rows.filter((row) => row.estado === t('reports.con-saldos')).length) },
    ],
  }
}

/** Exporta el reporte a CSV (mismo formato que /reports/{id}/export?format=csv). */
export function reportToCsv(report: Report): string {
  const escape = (value: string | number): string => {
    const text = String(value)
    return text.includes(',') || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = report.columns.map((column) => escape(column.label)).join(',')
  const body = report.rows.map((row) => report.columns.map((column) => escape(row[column.key] ?? '')).join(','))
  return [header, ...body].join('\n')
}

/** Descarga el reporte como archivo CSV en el navegador. */
export function downloadCsv(report: Report): void {
  const blob = new Blob([`\uFEFF${reportToCsv(report)}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.type}-${report.generated_at.slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Datos del gráfico de evolución para el reporte estadístico. */
export function getMonthlySummary(): Array<{ mes: string; ingresos: number; transacciones: number }> {
  return getMonthly({ months: 12, seller: '', category: '' })
}

/** Distribución de tickets para el reporte estadístico. */
export function getTicketDistribution() {
  return getDistribution({ months: 12, seller: '', category: '' })
}

/** Porcentaje formateado para las tablas de reporte. */
export const formatPct = (value: number): string => formatPercent(value / 100)

/** Tipo auxiliar para las ventas del reporte. */
export type ReportSale = Sale
