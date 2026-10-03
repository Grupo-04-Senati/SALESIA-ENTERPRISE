import type { AnalysisRecord, BayesInput, BayesResult } from '@/types/statistics'
import { ruleEnabled, ruleNumber } from '@/data/store'

/**
 * Servicio de probabilidad — Semana 07 (Fase 09 · RF-15, RF-17, RF-21).
 *
 * Los cálculos son **automáticos**: se aplican sobre los datos del sistema
 * (src/data/analytics.ts) y aquí quedan las piezas que dependen de la
 * configuración de Automatizaciones y el historial de análisis.
 * TODO(Fase 05): sustituir por /api/v1/probability y /statistics
 * (docs/05_api.md §2.9), conservando las mismas reglas RN-40 y RN-43.
 */

const round4 = (value: number): number => Math.round(value * 10000) / 10000

/** RN-40: mínimo de observaciones configurable en Automatizaciones. */
export function minObservations(): number {
  return ruleEnabled('RN-40_MINIMO_DATOS') ? ruleNumber('RN-40_MINIMO_DATOS', 'minimo', 2) : 1
}

/**
 * Teorema de Bayes: P(A|B) = P(B|A) · P(A) / P(B).
 * Las probabilidades llegan ya observadas en la operación real.
 * RN-43: con la regla activa, P(B) = 0 bloquea el cálculo.
 */
export function bayes(input: BayesInput): BayesResult {
  const { prior, likelihood, evidence } = input
  for (const [label, value] of [
    ['P(A)', prior],
    ['P(B|A)', likelihood],
    ['P(B)', evidence],
  ] as const) {
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new Error(`${label} debe ser una probabilidad entre 0 y 1.`)
    }
  }
  if (evidence === 0) {
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

/* ------------------------------------------------------------------
   Historial de análisis (RF-21) — se mantiene en memoria.
   Arranca vacío: solo se registran los cálculos del sistema real.
   ------------------------------------------------------------------ */

let history: AnalysisRecord[] = []

export function listAnalyses(): AnalysisRecord[] {
  return [...history].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Registra un cálculo automático (RF-21, desactivable desde Automatizaciones). */
export function registerAnalysis(record: Omit<AnalysisRecord, 'id' | 'created_at'>): AnalysisRecord {
  const entry: AnalysisRecord = {
    ...record,
    id: Math.max(...history.map((item) => item.id), 0) + 1,
    created_at: new Date().toISOString(),
  }
  if (ruleEnabled('RF-21_HISTORIAL')) {
    history = [entry, ...history].slice(0, 60)
  }
  return entry
}
