/**
 * Tipos de insights empresariales (docs/05_api.md §2.10, RF-18…RF-20).
 * RN-47: toda insight muestra su evidencia numérica.
 */

export type InsightSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'

/** Severidad en minúsculas para mapear al badge del sistema de diseño. */
export const SEVERITY_LABELS: Record<InsightSeverity, string> = {
  INFO: 'Informativo',
  SUCCESS: 'Positivo',
  WARNING: 'Alerta',
  CRITICAL: 'Crítico',
}

export interface Insight {
  id: number
  title: string
  severity: InsightSeverity
  /** Código de la regla determinística que lo generó (RF-18). */
  rule: string
  /** Explicación legible con las cifras concretas (RF-19). */
  message: string
  /** Evidencia numérica (RN-47). */
  evidence: Record<string, number | string>
  analysis_id: number | null
  dataset_id: number | null
  created_at: string
  read: boolean
}
