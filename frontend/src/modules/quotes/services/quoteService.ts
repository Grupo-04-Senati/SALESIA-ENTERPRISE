import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de cotizaciones contra la API.
 * El listado llega paginado: se pide completo con page=1&page_size=100.
 */

interface Page<T> {
  items: T[]
}

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted'

export interface QuoteLine {
  product_id: number
  quantity: number
  unit_price: number
  discount: number
}

export interface QuoteItem extends QuoteLine {
  id?: number
  product_name?: string
  subtotal?: number
}

export interface Quote {
  id: number
  quote_number: string
  customer_id: number
  customer_name: string
  status: QuoteStatus
  valid_until: string | null
  subtotal: number
  tax: number
  total: number
  /** Derivado del backend (tax/subtotal) para poder re-editar la cotización. */
  tax_rate?: number
  notes: string | null
  item_count: number
  created_at: string
  items?: QuoteItem[]
}

export interface QuoteInput {
  customer_id: number
  valid_until?: string | null
  notes?: string | null
  tax_rate?: number
  items: QuoteLine[]
}

export interface QuoteConverted {
  quote_number: string
  sale_id: number
  sale_number: string
}

export async function listQuotes(): Promise<Quote[]> {
  const page = await apiFetch<Page<Quote>>(`${ENDPOINTS.quotes}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getQuote(id: number): Promise<Quote> {
  return apiFetch<Quote>(`${ENDPOINTS.quotes}/${id}`)
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  return apiFetch<Quote>(ENDPOINTS.quotes, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateQuote(id: number, input: QuoteInput): Promise<Quote> {
  return apiFetch<Quote>(`${ENDPOINTS.quotes}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function setQuoteStatus(id: number, status: QuoteStatus): Promise<Quote> {
  return apiFetch<Quote>(`${ENDPOINTS.quotes}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

/** POST /quotes/{id}/convert — exige estado approved y crea la venta. */
export async function convertQuote(id: number): Promise<QuoteConverted> {
  const converted = await apiFetch<QuoteConverted>(`${ENDPOINTS.quotes}/${id}/convert`, {
    method: 'POST',
  })
  await hydrateStore(['sales', 'products', 'movements', 'customers'])
  return converted
}

export async function deleteQuote(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.quotes}/${id}`, { method: 'DELETE' })
}
