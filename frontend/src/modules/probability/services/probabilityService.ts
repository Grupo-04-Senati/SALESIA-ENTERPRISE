import type { AnalysisRecord, BayesInput, BayesResult, VariableClassification } from '@/types/statistics'
import { compareMeanMedian, mean, median } from '@/modules/analytics/services/statisticsService'
import { ruleEnabled, ruleNumber } from '@/data/store'

/**
 * Servicio de probabilidad y variables aleatorias (Fase 09 · RF-15…RF-17).
 * Calcula en el frontend replicando las reglas del backend para que las
 * vistas queden completas antes de la API (Fase 05).
 * TODO(Fase 05): sustituir por `apiFetch` contra
 * /api/v1/probability y /api/v1/statistics (docs/05_api.md §2.9).
 */

const round4 = (value: number): number => Math.round(value * 10000) / 10000

/** RN-40: se requieren al menos 2 observaciones. */
export function parseValues(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(Number)
    .filter((value) => !Number.isNaN(value))
}

/** RN-40: mínimo de observaciones configurable en Automatizaciones. */
export function minObservations(): number {
  return ruleEnabled('RN-40_MINIMO_DATOS') ? ruleNumber('RN-40_MINIMO_DATOS', 'minimo', 2) : 1
}

export function assertEnoughData(values: number[]): void {
  const minimum = minObservations()
  if (values.length < minimum) {
    throw new Error(
      `Se requieren al menos ${minimum} observación(es) según la configuración de Automatizaciones (RN-40).`,
    )
  }
}

/**
 * Teorema de Bayes: P(A|B) = P(B|A) · P(A) / P(B).
 * RN-43: si P(B) = 0 el posterior no está definido.
 */
export function bayes(input: BayesInput): BayesResult {
  const { prior, likelihood, evidence } = input
  for (const [label, value] of [['P(A)', prior], ['P(B|A)', likelihood], ['P(B)', evidence]] as const) {
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new Error(`${label} debe ser una probabilidad entre 0 y 1.`)
    }
  }
  if (evidence === 0) {
    // RN-43: con la regla activa el posterior no está definido.
    if (ruleEnabled('RN-43_BAYES_CERO')) {
      throw new Error('P(B) = 0: el posterior no está definido (RN-43 · regla activa).')
    }
    return {
      posterior: 0,
      prior: round4(prior),
      likelihood: round4(likelihood),
      evidence: 0,
      joint: round4(likelihood * prior),
      steps: [
        'La regla RN-43 está desactivada: se permite calcular con P(B) = 0.',
        'P(B) = 0 hace que el posterior sea indefinido; el sistema devuelve 0.',
      ],
    }
  }
  const joint = round4(likelihood * prior)
  const posterior = round4(joint / evidence)
  return {
    posterior,
    prior: round4(prior),
    likelihood: round4(likelihood),
    evidence: round4(evidence),
    joint,
    steps: [
      `P(B ∩ A) = P(B|A) × P(A) = ${round4(likelihood)} × ${round4(prior)} = ${joint}`,
      `P(A|B) = P(B ∩ A) / P(B) = ${joint} / ${round4(evidence)} = ${posterior}`,
      posterior >= prior
        ? 'La evidencia aumenta la probabilidad de A respecto a la previa.'
        : 'La evidencia disminuye la probabilidad de A respecto a la previa.',
    ],
  }
}

/** Clasifica una variable como cualitativa o cuantitativa (RF-16). */
export function classifyVariable(name: string, raw: string): VariableClassification {
  const parts = raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (parts.length < minObservations()) {
    throw new Error(
      `Se requieren al menos ${minObservations()} observaciones según la configuración de Automatizaciones (RN-40).`,
    )
  }

  const numbers = parts.map(Number)
  const isQuantitative = numbers.every((value) => !Number.isNaN(value))

  if (isQuantitative) {
    const values = numbers as number[]
    return {
      name: name || 'variable',
      type: 'quantitative',
      subtype: Number.isInteger(values[0]) ? 'discreta' : 'continua',
      count: values.length,
      mean: round4(mean(values)),
      median: round4(median(values)),
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  const counts = new Map<string, number>()
  for (const part of parts) {
    counts.set(part, (counts.get(part) ?? 0) + 1)
  }
  return {
    name: name || 'variable',
    type: 'qualitative',
    subtype: 'nominal',
    count: parts.length,
    frequencies: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count, pct: round4((count / parts.length) * 100) })),
  }
}

/* ------------------------------------------------------------------
   Historial de análisis (RF-21) — se mantiene en memoria
   ------------------------------------------------------------------ */

const SEED_HISTORY: AnalysisRecord[] = [
  { id: 1, kind: 'media', label: 'Media · tickets de septiembre', result: 'S/ 118.40', created_at: '2026-09-30T17:10:00Z' },
  { id: 2, kind: 'mediana', label: 'Mediana · tickets de septiembre', result: 'S/ 104.20', created_at: '2026-09-30T17:12:00Z' },
  { id: 3, kind: 'comparacion', label: 'Media vs. mediana · septiembre', result: 'Diferencia S/ 14.20 (13.6%)', created_at: '2026-09-30T17:15:00Z' },
  { id: 4, kind: 'bayes', label: 'Bayes · cliente fiel', result: 'P(A|B) = 0.72', created_at: '2026-09-29T10:05:00Z' },
  { id: 5, kind: 'variable', label: 'Variable · categoría de producto', result: 'Cualitativa nominal (8 valores)', created_at: '2026-09-28T14:40:00Z' },
  { id: 6, kind: 'media', label: 'Media · ventas de agosto', result: 'S/ 132.75', created_at: '2026-08-31T18:20:00Z' },
]

let history: AnalysisRecord[] = [...SEED_HISTORY]

export function listAnalyses(): AnalysisRecord[] {
  return [...history].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function registerAnalysis(record: Omit<AnalysisRecord, 'id' | 'created_at'>): AnalysisRecord {
  const entry: AnalysisRecord = {
    ...record,
    id: Math.max(...history.map((item) => item.id), 0) + 1,
    created_at: new Date().toISOString(),
  }
  // RF-21: si la regla está desactivada, el cálculo no se guarda.
  if (ruleEnabled('RF-21_HISTORIAL')) {
    history = [entry, ...history]
  }
  return entry
}

/** Resumen estadístico de un conjunto de valores. */
export function describe(values: number[]) {
  assertEnoughData(values)
  const compare = compareMeanMedian(values)
  return {
    count: values.length,
    mean: round4(mean(values)),
    median: round4(median(values)),
    min: Math.min(...values),
    max: Math.max(...values),
    range: round4(Math.max(...values) - Math.min(...values)),
    compare,
  }
}
