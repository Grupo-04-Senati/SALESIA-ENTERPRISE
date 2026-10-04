import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'

/**
 * Servicio de precios (FE-2 · /precios): listas de precios con sus líneas
 * y promociones con sus productos. Los listados llegan paginados: se piden
 * completos con page=1&page_size=100.
 */

interface Page<T> {
  items: T[]
}

export type PriceListStatus = 'active' | 'inactive'
export type PromotionKind = 'percent' | 'fixed'

export interface PriceListLine {
  id?: number
  product_id: number
  product_name?: string
  price: number
}

export interface PriceListLineInput {
  product_id: number
  price: number
}

export interface PriceList {
  id: number
  name: string
  currency: string
  status: PriceListStatus
  item_count: number
  created_at: string
  items?: PriceListLine[]
}

export interface PriceListInput {
  name: string
  currency?: string
  status?: PriceListStatus
}

export interface Promotion {
  id: number
  name: string
  kind: PromotionKind
  value: number
  starts_at: string | null
  ends_at: string | null
  status: string
  product_count: number
  product_ids?: number[]
  items?: Array<{ id?: number; product_id: number; product_name?: string }>
}

export interface PromotionInput {
  name: string
  kind: PromotionKind
  value: number
  starts_at?: string | null
  ends_at?: string | null
  product_ids: number[]
}

/* ------------------------------------------------------------------
   Listas de precios
   ------------------------------------------------------------------ */

export async function listPriceLists(): Promise<PriceList[]> {
  const page = await apiFetch<Page<PriceList>>(`${ENDPOINTS.priceLists}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPriceList(id: number): Promise<PriceList> {
  return apiFetch<PriceList>(`${ENDPOINTS.priceLists}/${id}`)
}

export async function createPriceList(input: PriceListInput): Promise<PriceList> {
  return apiFetch<PriceList>(ENDPOINTS.priceLists, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePriceList(id: number, input: PriceListInput): Promise<PriceList> {
  return apiFetch<PriceList>(`${ENDPOINTS.priceLists}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** PUT /price-lists/{id}/items — reemplaza por completo las líneas de la lista. */
export async function replacePriceListItems(
  id: number,
  items: PriceListLineInput[],
): Promise<PriceList> {
  return apiFetch<PriceList>(`${ENDPOINTS.priceLists}/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
}

export async function deletePriceList(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.priceLists}/${id}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------
   Promociones
   ------------------------------------------------------------------ */

export async function listPromotions(): Promise<Promotion[]> {
  const page = await apiFetch<Page<Promotion>>(`${ENDPOINTS.promotions}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPromotion(id: number): Promise<Promotion> {
  return apiFetch<Promotion>(`${ENDPOINTS.promotions}/${id}`)
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  return apiFetch<Promotion>(ENDPOINTS.promotions, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePromotion(id: number, input: PromotionInput): Promise<Promotion> {
  return apiFetch<Promotion>(`${ENDPOINTS.promotions}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deletePromotion(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.promotions}/${id}`, { method: 'DELETE' })
}
