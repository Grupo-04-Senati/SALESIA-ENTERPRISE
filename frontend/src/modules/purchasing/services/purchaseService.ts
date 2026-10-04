import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de compras (proveedores, órdenes de compra y envíos) contra la API.
 * Los listados llegan paginados: se piden completos con page=1&page_size=100.
 */

interface Page<T> {
  items: T[]
}

export type SupplierStatus = 'active' | 'inactive'
export type PurchaseOrderStatus = 'pending' | 'approved' | 'received' | 'cancelled'
export type ShipmentStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled'

export interface Supplier {
  id: number
  ruc: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  status: SupplierStatus
}

export interface SupplierInput {
  ruc: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export interface PurchaseOrderLine {
  product_id: number
  quantity: number
  unit_cost: number
}

export interface PurchaseOrderItem extends PurchaseOrderLine {
  id?: number
  product_name?: string
  subtotal?: number
}

export interface PurchaseOrder {
  id: number
  order_number: string
  supplier_id: number
  supplier_name: string
  status: PurchaseOrderStatus
  total: number
  notes: string | null
  item_count: number
  created_at: string
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderInput {
  supplier_id: number
  notes?: string | null
  items: PurchaseOrderLine[]
}

export interface Shipment {
  id: number
  sale_id: number
  sale_number: string
  carrier: string | null
  tracking_code: string | null
  status: ShipmentStatus
  shipped_at: string | null
  created_at: string
}

export interface ShipmentInput {
  sale_id: number
  carrier?: string | null
  tracking_code?: string | null
  status?: ShipmentStatus
}

/* ------------------------------------------------------------------
   Proveedores
   ------------------------------------------------------------------ */

export async function listSuppliers(): Promise<Supplier[]> {
  const page = await apiFetch<Page<Supplier>>(`${ENDPOINTS.suppliers}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>(ENDPOINTS.suppliers, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSupplier(id: number, input: SupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>(`${ENDPOINTS.suppliers}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteSupplier(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.suppliers}/${id}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------
   Órdenes de compra
   ------------------------------------------------------------------ */

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const page = await apiFetch<Page<PurchaseOrder>>(
    `${ENDPOINTS.purchaseOrders}?page=1&page_size=100`,
  )
  return [...page.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`${ENDPOINTS.purchaseOrders}/${id}`)
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(ENDPOINTS.purchaseOrders, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePurchaseOrder(
  id: number,
  input: PurchaseOrderInput,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`${ENDPOINTS.purchaseOrders}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** PATCH /purchase-orders/{id}/status — al recibir, el backend mueve el stock. */
export async function setPurchaseOrderStatus(
  id: number,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder> {
  const order = await apiFetch<PurchaseOrder>(`${ENDPOINTS.purchaseOrders}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (status === 'received') await hydrateStore(['products', 'movements'])
  return order
}

export async function deletePurchaseOrder(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.purchaseOrders}/${id}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------
   Envíos
   ------------------------------------------------------------------ */

export async function listShipments(): Promise<Shipment[]> {
  const page = await apiFetch<Page<Shipment>>(`${ENDPOINTS.shipments}?page=1&page_size=100`)
  return [...page.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createShipment(input: ShipmentInput): Promise<Shipment> {
  return apiFetch<Shipment>(ENDPOINTS.shipments, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateShipment(id: number, input: ShipmentInput): Promise<Shipment> {
  return apiFetch<Shipment>(`${ENDPOINTS.shipments}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function setShipmentStatus(id: number, status: ShipmentStatus): Promise<Shipment> {
  return apiFetch<Shipment>(`${ENDPOINTS.shipments}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteShipment(id: number): Promise<void> {
  await apiFetch(`${ENDPOINTS.shipments}/${id}`, { method: 'DELETE' })
}
