/**
 * Formateadores de presentación (txt §5.6: números 1,234.56 ·
 * moneda S/ 1,250.00 · porcentajes 45.2% · fechas dd/MM/yyyy).
 */

const numberFmt = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const moneyFmt = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Número con separadores de miles: 1234.5 → "1,234.5". */
export const formatNumber = (value: number): string => numberFmt.format(value)

/** Moneda soles: 1250 → "S/ 1,250.00". */
export const formatCurrency = (value: number): string => `S/ ${moneyFmt.format(value)}`

/** Porcentaje desde fracción: 0.452 → "45.2%". */
export const formatPercent = (fraction: number, decimals = 1): string =>
  `${(fraction * 100).toFixed(decimals)}%`

const pad = (n: number): string => String(n).padStart(2, '0')

const toDate = (value: string | Date): Date | null => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

/** Fecha corta: "2026-10-01" → "01/10/2026" ("—" si es inválida). */
export const formatDate = (value: string | Date): string => {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Fecha y hora: "…" → "01/10/2026 14:30" ("—" si es inválida). */
export const formatDateTime = (value: string | Date): string => {
  const date = toDate(value)
  if (!date) return '—'
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
