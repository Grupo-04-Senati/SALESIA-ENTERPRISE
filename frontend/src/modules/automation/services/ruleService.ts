import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Reglas de automatización guardadas (ENDPOINTS.automationRules) contra
 * la API: se distinguen de las reglas configurables locales porque aquí
 * el backend valida el código único por empresa y ejecuta la lógica.
 */

export type RuleSeverity = 'info' | 'warning' | 'critical'

export const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  info: 'Informativa',
  warning: 'Advertencia',
  critical: 'Crítica',
}

export interface SavedRule {
  id: number
  code: string
  name: string
  description: string | null
  condition: Record<string, unknown> | null
  action: Record<string, unknown> | null
  severity: RuleSeverity
  status: 'active' | 'inactive'
  created_at: string
}

export interface SavedRuleInput {
  code: string
  name: string
  description?: string | null
  condition?: Record<string, unknown> | null
  action?: Record<string, unknown> | null
  severity: RuleSeverity
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(): Promise<SavedRule[]> {
  const first = await apiFetch<Page<SavedRule>>(`${ENDPOINTS.automationRules}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<SavedRule>>(
      `${ENDPOINTS.automationRules}?page=${page}&page_size=100`,
    )
    items.push(...next.items)
  }
  return items.sort((a, b) => a.code.localeCompare(b.code))
}

export async function listSavedRules(): Promise<SavedRule[]> {
  return fetchAll()
}

export async function createSavedRule(input: SavedRuleInput): Promise<SavedRule> {
  return apiFetch<SavedRule>(ENDPOINTS.automationRules, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSavedRule(id: number, input: SavedRuleInput): Promise<SavedRule> {
  return apiFetch<SavedRule>(`${ENDPOINTS.automationRules}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteSavedRule(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.automationRules}/${id}`, { method: 'DELETE' })
}
