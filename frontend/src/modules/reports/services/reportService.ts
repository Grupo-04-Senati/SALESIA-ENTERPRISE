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

export const REPORT_TYPES = [
  { value: 'ventas', label: 'Reporte de ventas', description: 'Detalle de ventas, estados y totales.' },
  { value: 'estadistico', label: 'Reporte estadístico', description: 'Indicadores, distribución y media/mediana.' },
  { value: 'productos', label: 'Reporte de productos', description: 'Catálogo, precios y nivel de stock.' },
  { value: 'clientes', label: 'Reporte de clientes', description: 'Segmentación y comportamiento de compra.' },
  { value: 'vendedores', label: 'Reporte de vendedores', description: 'Ingresos y ventas por vendedor.' },
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

export async function generateReport(type: ReportType): Promise<Report> {
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
      title: 'Reporte de ventas',
      description: 'Detalle de ventas registradas en el periodo.',
      generated_at,
      columns: [
        { key: 'venta', label: 'Venta' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'vendedor', label: 'Vendedor' },
        { key: 'estado', label: 'Estado' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'saldo', label: 'Saldo', align: 'right' },
      ],
      rows,
      summary: [
        { label: 'Ventas registradas', value: formatNumber(sales.length) },
        { label: 'Ventas válidas', value: formatNumber(válidas.length) },
        {
          label: 'Ingresos totales',
          value: money(válidas.reduce((total, sale) => total + sale.total, 0)),
        },
        {
          label: 'Saldo por cobrar',
          value: money(sales.reduce((total, sale) => total + sale.balance, 0)),
        },
      ],
    }
  }

  if (type === 'estadistico') {
    const kpis = getKpis({ months: 12, seller: '', category: '' })
    const dataset = getTicketDataset({ months: 12, seller: '', category: '' })
    const compare = compareMeanMedian(dataset)
    const rows: ReportRow[] = [
      { indicador: 'Ingresos del periodo', valor: kpis.ingresos, unidad: 'S/' },
      { indicador: 'Transacciones', valor: kpis.transacciones, unidad: 'uds' },
      { indicador: 'Ticket promedio', valor: kpis.ticketPromedio, unidad: 'S/' },
      { indicador: 'Media de tickets', valor: round2(compare.mean), unidad: 'S/' },
      { indicador: 'Mediana de tickets', valor: round2(compare.median), unidad: 'S/' },
      { indicador: 'Diferencia media − mediana', valor: compare.difference, unidad: 'S/' },
      { indicador: 'Variación mensual', valor: kpis.variacionMensual, unidad: '%' },
      { indicador: 'Mínimo del ticket', valor: Math.min(...dataset), unidad: 'S/' },
      { indicador: 'Máximo del ticket', valor: Math.max(...dataset), unidad: 'S/' },
    ]
    return {
      type,
      title: 'Reporte estadístico',
      description: 'Indicadores descriptivos de los tickets de venta (Semana 07).',
      generated_at,
      columns: [
        { key: 'indicador', label: 'Indicador' },
        { key: 'valor', label: 'Valor', align: 'right' },
        { key: 'unidad', label: 'Unidad' },
      ],
      rows,
      summary: [
        { label: 'Observaciones analizadas', value: formatNumber(dataset.length) },
        { label: 'Interpretación', value: compare.interpretation },
        { label: 'Meses incluidos', value: '12' },
      ],
    }
  }

  if (type === 'productos') {
    const products = await listProducts()
    const rows: ReportRow[] = products.map((product) => ({
      sku: product.sku,
      producto: product.name,
      categoria: product.category.name,
      costo: product.cost_price,
      precio: product.sale_price,
      margen: round2(((product.sale_price - product.cost_price) / Math.max(product.sale_price, 1)) * 100),
      stock: product.current_stock,
      minimo: product.min_stock,
      estado: product.status,
    }))
    return {
      type,
      title: 'Reporte de productos',
      description: 'Catálogo con precios, margen y nivel de stock.',
      generated_at,
      columns: [
        { key: 'sku', label: 'SKU' },
        { key: 'producto', label: 'Producto' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'precio', label: 'Precio', align: 'right' },
        { key: 'margen', label: 'Margen (%)', align: 'right' },
        { key: 'stock', label: 'Stock', align: 'right' },
        { key: 'estado', label: 'Estado' },
      ],
      rows,
      summary: [
        { label: 'Productos activos', value: formatNumber(products.filter((p) => p.status === 'active').length) },
        { label: 'Productos en alerta', value: formatNumber(products.filter((p) => p.current_stock <= p.min_stock).length) },
        {
          label: 'Valor de inventario (costo)',
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
      title: 'Reporte de clientes',
      description: 'Segmentación y comportamiento de compra por cliente.',
      generated_at,
      columns: [
        { key: 'cliente', label: 'Cliente' },
        { key: 'documento', label: 'Documento' },
        { key: 'segmento', label: 'Segmento' },
        { key: 'compras', label: 'Compras', align: 'right' },
        { key: 'total_comprado', label: 'Total comprado', align: 'right' },
        { key: 'ticket_promedio', label: 'Ticket prom.', align: 'right' },
        { key: 'estado', label: 'Estado' },
      ],
      rows,
      summary: [
        { label: 'Clientes', value: formatNumber(customers.length) },
        { label: 'Clientes activos', value: formatNumber(customers.filter((c) => c.status === 'active').length) },
        {
          label: 'Facturación acumulada',
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
      estado: propias.some((sale) => sale.status !== 'paid') ? 'Con saldos' : 'Al día',
    }
  })
  return {
    type: 'vendedores',
    title: 'Reporte de vendedores',
    description: 'Ingresos, tickets y participación por vendedor.',
    generated_at,
    columns: [
      { key: 'vendedor', label: 'Vendedor' },
      { key: 'ventas', label: 'Ventas', align: 'right' },
      { key: 'ingresos', label: 'Ingresos', align: 'right' },
      { key: 'ticket_promedio', label: 'Ticket prom.', align: 'right' },
      { key: 'participación', label: 'Participación (%)', align: 'right' },
      { key: 'estado', label: 'Estado' },
    ],
    rows,
    summary: [
      { label: 'Vendedores', value: formatNumber(bySeller.length) },
      { label: 'Ingresos atribuidos', value: money(bySeller.reduce((total, seller) => total + seller.ingresos, 0)) },
      { label: 'Vendedores con saldos', value: formatNumber(rows.filter((row) => row.estado === 'Con saldos').length) },
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
