/**
 * Tipos de estadística — Semana 07 (docs/05_api.md §2.8, RF-10…RF-14).
 */

export interface Period {
  from: string
  to: string
}

/** Resultado de media o mediana. */
export interface MetricResult {
  metric: 'mean' | 'median'
  value: number
  count: number
  min?: number
  max?: number
  period?: Period
  analysis_id?: number
  calculated_at?: string
}

/** Comparación media vs. mediana (RF-13). */
export interface CompareResult {
  mean: number
  median: number
  difference: number
  difference_pct: number
  interpretation: string
}

export interface Frequency {
  value: string
  count: number
  pct: number
}

/** Variable clasificada (RF-14). */
export interface VariableInfo {
  name: string
  type: 'quantitative' | 'qualitative'
  subtype: string
  count: number
  mean?: number
  median?: number
  min?: number
  max?: number
  frequencies?: Frequency[]
}

export interface VariablesResult {
  variables: VariableInfo[]
}

/**
 * Entrada de cálculo: valores directos (pruebas académicas)
 * o referencia a dataset del backend.
 */
export interface StatInput {
  values?: number[]
  dataset_id?: number
  field?: string
  save_history?: boolean
}

/* ------------------------------------------------------------------
   Probabilidad y variables aleatorias (Fase 09 · RF-15…RF-17)
   ------------------------------------------------------------------ */

/** Entrada del teorema de Bayes. */
export interface BayesInput {
  /** P(A): probabilidad previa del evento A. */
  prior: number
  /** P(B|A): verosimilitud. */
  likelihood: number
  /** P(B): evidencia total. */
  evidence: number
}

/** Resultado del teorema de Bayes. */
export interface BayesResult {
  posterior: number
  prior: number
  likelihood: number
  evidence: number
  /** Verosimilitud conjunta P(B ∩ A). */
  joint: number
  /** Explicación paso a paso (reproducible, RF-17). */
  steps: string[]
}

/** Variable aleatoria clasificada (RF-16). */
export interface VariableClassification {
  name: string
  type: 'quantitative' | 'qualitative'
  subtype: string
  count: number
  mean?: number
  median?: number
  min?: number
  max?: number
  frequencies?: Array<{ value: string; count: number; pct: number }>
}

/** Análisis registrado en el historial (RF-21). */
export interface AnalysisRecord {
  id: number
  kind: 'media' | 'mediana' | 'comparacion' | 'bayes' | 'variable' | 'prediccion'
  label: string
  result: string
  created_at: string
}
