import { createSeedState } from './seed'
import type { SeedState } from './seed'
import { DEFAULT_RULES } from './rules'
import type { AutomationRule } from './rules'

/**
 * Almacén de datos en memoria — copia local de los datos de la API.
 *
 * El almacén se hidrata desde la API (services/hydrate.ts) al iniciar sesión
 * y con cada registro nuevo; las vistas leen de aquí para recalcular al
 * instante. Las trazas de proceso y las reglas de automatización viven en
 * este estado (las reglas además persisten en localStorage).
 */

export interface TraceStep {
  /** Módulo afectado: ventas · inventario · clientes · productos · analítica. */
  module: string
  label: string
  detail: string
}

export interface ProcessTrace {
  id: number
  at: string
  title: string
  steps: TraceStep[]
}

export interface StoreState extends SeedState {
  traces: ProcessTrace[]
  rules: AutomationRule[]
}

/* ------------------------------------------------------------------
   Reglas de automatización: preferencias del navegador (localStorage).
   ------------------------------------------------------------------ */

const RULES_KEY = 'salesia_rules'

interface RuleOverride {
  enabled?: boolean
  params?: Record<string, number | boolean>
}
type RuleOverrides = Record<string, RuleOverride>

function loadRuleOverrides(): RuleOverrides {
  try {
    const raw = localStorage.getItem(RULES_KEY)
    return raw ? (JSON.parse(raw) as RuleOverrides) : {}
  } catch {
    return {}
  }
}

function saveRuleOverrides(rules: AutomationRule[]): void {
  const overrides: RuleOverrides = {}
  for (const rule of rules) {
    overrides[rule.code] = {
      enabled: rule.enabled,
      params: Object.fromEntries(rule.params.map((param) => [param.key, param.value])),
    }
  }
  localStorage.setItem(RULES_KEY, JSON.stringify(overrides))
}

function initialRules(): AutomationRule[] {
  const overrides = loadRuleOverrides()
  return DEFAULT_RULES.map((rule) => {
    const override = overrides[rule.code]
    if (!override) return { ...rule }
    return {
      ...rule,
      enabled: override.enabled ?? rule.enabled,
      params: rule.params.map((param) => ({
        ...param,
        value: override.params?.[param.key] ?? param.value,
      })),
    }
  })
}

let state: StoreState = { ...createSeedState(), traces: [], rules: initialRules() }
let traceId = 0

type Listener = () => void
const listeners = new Set<Listener>()

/** Suscripción a los cambios del almacén (usado por DataProvider). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function commit(): void {
  listeners.forEach((listener) => listener())
}

/** Estado actual (solo lectura). */
export function getState(): StoreState {
  return state
}

/**
 * Sustituye uno o varios fragmentos del estado con los datos reales de la
 * API (hidratación). Lanza la suscripción para que las vistas que leen del
 * almacén se recalculen.
 */
export function hydrate(partial: Partial<SeedState>): void {
  state = { ...state, ...partial }
  commit()
}

/** Registra una traza de proceso devuelta por el backend (RF trazabilidad). */
export function logProcessTrace(title: string, steps: TraceStep[]): ProcessTrace {
  return logTrace(title, steps)
}

/** Trazas de los últimos procesos ejecutados. */
export function getTraces(): ProcessTrace[] {
  return state.traces
}

function logTrace(title: string, steps: TraceStep[]): ProcessTrace {
  const trace: ProcessTrace = { id: ++traceId, at: new Date().toISOString(), title, steps }
  state = { ...state, traces: [trace, ...state.traces].slice(0, 25) }
  return trace
}

/* ------------------------------------------------------------------
   Automatizaciones: las reglas se configuran desde el frontend y se
   aplican en la simulación en el momento, sin cambiar el código.
   ------------------------------------------------------------------ */

export function getRules(): AutomationRule[] {
  return state.rules
}

/** ¿Está activa una regla automática? */
export function ruleEnabled(code: string): boolean {
  return state.rules.find((rule) => rule.code === code)?.enabled ?? false
}

/** Valor de un parámetro de una regla. */
export function ruleParam(code: string, key: string): number | boolean | undefined {
  return state.rules.find((rule) => rule.code === code)?.params.find((param) => param.key === key)?.value
}

/** Valor numérico de un parámetro con valor por defecto. */
export function ruleNumber(code: string, key: string, fallback: number): number {
  const value = ruleParam(code, key)
  return typeof value === 'number' ? value : fallback
}

export function setRuleEnabled(code: string, enabled: boolean): void {
  state = {
    ...state,
    rules: state.rules.map((rule) => (rule.code === code ? { ...rule, enabled } : rule)),
  }
  saveRuleOverrides(state.rules)
  commit()
}

export function setRuleParam(code: string, key: string, value: number | boolean): void {
  state = {
    ...state,
    rules: state.rules.map((rule) =>
      rule.code === code
        ? { ...rule, params: rule.params.map((param) => (param.key === key ? { ...param, value } : param)) }
        : rule,
    ),
  }
  saveRuleOverrides(state.rules)
  commit()
}

/** Restaura las reglas a su configuración inicial. */
export function resetRules(): void {
  state = { ...state, rules: DEFAULT_RULES.map((rule) => ({ ...rule })) }
  saveRuleOverrides(state.rules)
  commit()
}

/** ¿Un producto está en alerta de stock según la regla configurada? */
export function isLowStock(product: { current_stock: number; min_stock: number }): boolean {
  if (!ruleEnabled('ALERTA_STOCK')) return false
  const factor = ruleNumber('ALERTA_STOCK', 'factor', 100) / 100
  return product.current_stock <= product.min_stock * factor
}
