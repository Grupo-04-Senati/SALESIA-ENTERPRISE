import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Sucursales (ENDPOINTS.branches) contra la API.
 */

export interface Branch {
  id: number
  code: string
  name: string
  address: string | null
  phone: string | null
  status: 'active' | 'inactive'
}

export interface BranchInput {
  code: string
  name: string
  address?: string | null
  phone?: string | null
}

interface Page<T> {
  items: T[]
  pages?: number
}

async function fetchAll(): Promise<Branch[]> {
  const first = await apiFetch<Page<Branch>>(`${ENDPOINTS.branches}?page=1&page_size=100`)
  const items = [...first.items]
  const pages = Math.min(first.pages ?? 1, 20)
  for (let page = 2; page <= pages; page += 1) {
    const next = await apiFetch<Page<Branch>>(`${ENDPOINTS.branches}?page=${page}&page_size=100`)
    items.push(...next.items)
  }
  return items.sort((a, b) => a.code.localeCompare(b.code))
}

export async function listBranches(): Promise<Branch[]> {
  return fetchAll()
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  return apiFetch<Branch>(ENDPOINTS.branches, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateBranch(id: number, input: BranchInput): Promise<Branch> {
  return apiFetch<Branch>(`${ENDPOINTS.branches}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteBranch(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.branches}/${id}`, { method: 'DELETE' })
}
