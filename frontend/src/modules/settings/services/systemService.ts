import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Servicio de sistema (ENDPOINTS.notifications, dataExports y
 * scheduledReports) contra la API: notificaciones de la empresa,
 * exportaciones de datos y reportes programados.
 */

export type NotificationLevel = 'info' | 'warning' | 'success' | 'error'

export const NOTIFICATION_LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: 'Info',
  warning: 'Advertencia',
  success: 'Éxito',
  error: 'Error',
}

export interface AppNotification {
  id: number
  level: NotificationLevel
  title: string
  message: string
  read_at: string | null
  created_at: string
}

export interface NotificationInput {
  title: string
  message: string
  level: NotificationLevel
}

export type ExportType = 'sales' | 'products' | 'customers' | 'inventory' | 'returns' | 'quotes'

export type ExportFormat = 'csv' | 'xlsx' | 'json'

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  sales: 'Ventas',
  products: 'Productos',
  customers: 'Clientes',
  inventory: 'Inventario',
  returns: 'Devoluciones',
  quotes: 'Cotizaciones',
}

export interface DataExport {
  id: number
  export_type: ExportType
  format: ExportFormat
  status: string
  row_count: number
  requested_by_name: string | null
  created_at: string
}

export interface DataExportInput {
  export_type: ExportType
  format: ExportFormat
}

export type ReportFrequency = 'daily' | 'weekly' | 'monthly'

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
}

export type ReportType = 'ventas' | 'estadistico' | 'productos' | 'clientes' | 'vendedores'

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ventas: 'Ventas',
  estadistico: 'Estadístico',
  productos: 'Productos',
  clientes: 'Clientes',
  vendedores: 'Vendedores',
}

export interface ScheduledReport {
  id: number
  report_type: ReportType
  title: string
  parameters: Record<string, unknown> | null
  frequency: ReportFrequency
  next_run_at: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface ScheduledReportInput {
  report_type: ReportType
  title: string
  parameters?: Record<string, unknown> | null
  frequency: ReportFrequency
  next_run_at?: string | null
  status?: 'active' | 'inactive'
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const first = await apiFetch<Page<T>>(`${path}${separator}page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<T>>(`${path}${separator}page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items
}

export async function listNotifications(unread = false): Promise<AppNotification[]> {
  const path = unread ? `${ENDPOINTS.notifications}?unread=true` : ENDPOINTS.notifications
  const items = await fetchAll<AppNotification>(path)
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createNotification(input: NotificationInput): Promise<AppNotification> {
  return apiFetch<AppNotification>(ENDPOINTS.notifications, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  return apiFetch<AppNotification>(`${ENDPOINTS.notifications}/${id}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(`${ENDPOINTS.notifications}/read-all`, { method: 'POST' })
}

export async function deleteNotification(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.notifications}/${id}`, { method: 'DELETE' })
}

export async function listDataExports(): Promise<DataExport[]> {
  const items = await fetchAll<DataExport>(ENDPOINTS.dataExports)
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** El backend calcula el número real de filas (row_count) al crearla. */
export async function createDataExport(input: DataExportInput): Promise<DataExport> {
  return apiFetch<DataExport>(ENDPOINTS.dataExports, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deleteDataExport(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.dataExports}/${id}`, { method: 'DELETE' })
}

export async function listScheduledReports(): Promise<ScheduledReport[]> {
  const items = await fetchAll<ScheduledReport>(ENDPOINTS.scheduledReports)
  return items.sort((a, b) => a.title.localeCompare(b.title))
}

export async function createScheduledReport(
  input: ScheduledReportInput,
): Promise<ScheduledReport> {
  return apiFetch<ScheduledReport>(ENDPOINTS.scheduledReports, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateScheduledReport(
  id: number,
  input: ScheduledReportInput,
): Promise<ScheduledReport> {
  return apiFetch<ScheduledReport>(`${ENDPOINTS.scheduledReports}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteScheduledReport(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.scheduledReports}/${id}`, { method: 'DELETE' })
}
