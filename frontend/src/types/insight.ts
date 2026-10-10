/**
 * Tipos de insights empresariales (docs/05_api.md §2.10, RF-18…RF-20).
 * RN-47: toda insight muestra su evidencia numérica.
 */

export type InsightSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'

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
