import type { Customer, CustomerInput } from '@/types/customer'
import type { SaleStatus } from '@/types/sale'

/**
 * Servicio de clientes (RF-03) con datos en memoria.
 * TODO(Fase 05): sustituir las funciones por `apiFetch` contra FastAPI
 * (GET/POST/PUT/DELETE /api/v1/customers — docs/05_api.md §2.3).
 * La forma de los datos es exactamente la de la API real.
 */

const SEGMENTS = ['Nuevo', 'Ocasional', 'Recurrente', 'Frecuente'] as const

interface SeedCustomer extends CustomerInput {
  id: number
  status: 'active' | 'inactive'
  created_at: string
  purchase_count: number
  total_purchased: number
}

const SEED: SeedCustomer[] = [
  { id: 1, document_type: 'DNI', document_number: '74125896', name: 'María Quispe', email: 'maria.quispe@correo.com', phone: '+51987654321', address: 'Av. Los Olivos 123, Lima', segment: 'Recurrente', status: 'active', created_at: '2026-03-14T10:05:00Z', purchase_count: 18, total_purchased: 1450.5 },
  { id: 2, document_type: 'DNI', document_number: '45812369', name: 'Jorge Ramírez', email: 'jorge.ramirez@correo.com', phone: '+51912345678', address: 'Jr. Cusco 450, Wanchaq, Cusco', segment: 'Frecuente', status: 'active', created_at: '2025-11-02T15:40:00Z', purchase_count: 34, total_purchased: 3820.9 },
  { id: 3, document_type: 'RUC', document_number: '20512345678', name: 'Comercial Andina S.A.C.', email: 'compras@comercialandina.pe', phone: '+51988112233', address: 'Av. Argentina 2890, Callao', segment: 'Frecuente', status: 'active', created_at: '2025-09-18T09:15:00Z', purchase_count: 41, total_purchased: 12850.0 },
  { id: 4, document_type: 'DNI', document_number: '60238741', name: 'Lucía Fernández', email: 'lucia.fernandez@correo.com', phone: '+51999887766', address: 'Calle Los Pinos 222, San Isidro', segment: 'Nuevo', status: 'active', created_at: '2026-06-21T12:00:00Z', purchase_count: 2, total_purchased: 145.8 },
  { id: 5, document_type: 'DNI', document_number: '72341589', name: 'Carlos Ttito', email: 'carlos.ttito@correo.com', phone: '+51955443322', address: 'Av. Del Sol 412, Cusco', segment: 'Recurrente', status: 'active', created_at: '2026-01-09T17:25:00Z', purchase_count: 12, total_purchased: 980.4 },
  { id: 6, document_type: 'DNI', document_number: '41902365', name: 'Ana Torres', email: 'ana.torres@correo.com', phone: '+51966778899', address: 'Jr. Bolognesi 118, Arequipa', segment: 'Recurrente', status: 'active', created_at: '2025-12-30T11:45:00Z', purchase_count: 15, total_purchased: 1310.75 },
  { id: 7, document_type: 'DNI', document_number: '75612348', name: 'Luis Ríos', email: 'luis.rios@correo.com', phone: '+51933221144', address: 'Av. Túpac Amaru 3050, Lima', segment: 'Ocasional', status: 'active', created_at: '2026-04-03T08:30:00Z', purchase_count: 5, total_purchased: 412.0 },
  { id: 8, document_type: 'DNI', document_number: '48756123', name: 'Carmen Vega', email: 'carmen.vega@correo.com', phone: '+51977665544', address: 'Calle Tacna 234, Juliaca', segment: 'Recurrente', status: 'active', created_at: '2026-02-14T14:20:00Z', purchase_count: 21, total_purchased: 1875.3 },
  { id: 9, document_type: 'DNI', document_number: '70125634', name: 'Pedro Salazar', email: 'pedro.salazar@correo.com', phone: '+51911223344', address: 'Av. Brasil 1450, Jesús María', segment: 'Nuevo', status: 'active', created_at: '2026-07-12T10:10:00Z', purchase_count: 1, total_purchased: 79.9 },
  { id: 10, document_type: 'RUC', document_number: '20601234567', name: 'Distribuidora Sur E.I.R.L.', email: 'contacto@distrisur.pe', phone: '+51988445566', address: 'Av. Ejército 780, Arequipa', segment: 'Frecuente', status: 'active', created_at: '2025-10-05T16:00:00Z', purchase_count: 37, total_purchased: 9640.2 },
  { id: 11, document_type: 'DNI', document_number: '61234598', name: 'Rosa Huamán', email: 'rosa.huaman@correo.com', phone: '+51944556677', address: 'Jr. Huánuco 302, Huancayo', segment: 'Recurrente', status: 'active', created_at: '2026-03-27T13:35:00Z', purchase_count: 9, total_purchased: 725.6 },
  { id: 12, document_type: 'DNI', document_number: '73456128', name: 'Miguel Castro', email: 'miguel.castro@correo.com', phone: '+51955332211', address: 'Av. Pardo 501, Miraflores', segment: 'Ocasional', status: 'active', created_at: '2026-05-16T09:50:00Z', purchase_count: 4, total_purchased: 318.5 },
  { id: 13, document_type: 'DNI', document_number: '47856231', name: 'Fernanda Rojas', email: 'fernanda.rojas@correo.com', phone: '+51966887755', address: 'Calle Independencia 89, Trujillo', segment: 'Recurrente', status: 'active', created_at: '2026-01-25T15:05:00Z', purchase_count: 14, total_purchased: 1122.9 },
  { id: 14, document_type: 'DNI', document_number: '75012369', name: 'Diego Mendoza', email: 'diego.mendoza@correo.com', phone: '+51977223344', address: 'Av. San Martín 1220, Trujillo', segment: 'Nuevo', status: 'active', created_at: '2026-08-02T11:15:00Z', purchase_count: 3, total_purchased: 260.4 },
  { id: 15, document_type: 'CE', document_number: '00124587', name: 'Valeria Cruz', email: 'valeria.cruz@correo.com', phone: '+51988990011', address: 'Av. La Marina 2100, Lima', segment: 'Ocasional', status: 'active', created_at: '2026-06-08T18:40:00Z', purchase_count: 6, total_purchased: 540.0 },
  { id: 16, document_type: 'DNI', document_number: '43658712', name: 'José Ninahuanca', email: 'jose.ninahuanca@correo.com', phone: '+51911556677', address: 'Jr. Camaná 455, Cercado, Lima', segment: 'Recurrente', status: 'active', created_at: '2025-12-11T10:30:00Z', purchase_count: 23, total_purchased: 2040.15 },
  { id: 17, document_type: 'DNI', document_number: '76540123', name: 'Gabriela Paredes', email: 'gabriela.paredes@correo.com', phone: '+51933778899', address: 'Av. Petit Thouars 5400, Lima', segment: 'Nuevo', status: 'active', created_at: '2026-08-21T14:55:00Z', purchase_count: 1, total_purchased: 59.9 },
  { id: 18, document_type: 'DNI', document_number: '40125638', name: 'Roberto Chávez', email: 'roberto.chavez@correo.com', phone: '+51966112233', address: 'Av. Piérola 310, Ica', segment: 'Recurrente', status: 'active', created_at: '2026-02-02T12:25:00Z', purchase_count: 17, total_purchased: 1398.6 },
  { id: 19, document_type: 'DNI', document_number: '75863214', name: 'Sofía Aguilar', email: 'sofia.aguilar@correo.com', phone: '+51944889900', address: 'Calle Schell 456, Chiclayo', segment: 'Ocasional', status: 'inactive', created_at: '2025-11-27T16:10:00Z', purchase_count: 7, total_purchased: 486.7 },
  { id: 20, document_type: 'DNI', document_number: '48236519', name: 'Marco Villanueva', email: 'marco.villanueva@correo.com', phone: '+51955998877', address: 'Av. Grau 780, Piura', segment: 'Recurrente', status: 'active', created_at: '2026-04-19T09:05:00Z', purchase_count: 11, total_purchased: 865.2 },
  { id: 21, document_type: 'DNI', document_number: '74568912', name: 'Patricia León', email: 'patricia.leon@correo.com', phone: '+51977445566', address: 'Jr. Ancash 320, Cercado, Lima', segment: 'Recurrente', status: 'active', created_at: '2026-05-30T17:45:00Z', purchase_count: 13, total_purchased: 1052.3 },
  { id: 22, document_type: 'DNI', document_number: '62345789', name: 'Andrés Aguayo', email: 'andres.aguayo@correo.com', phone: '+51911667788', address: 'Av. Universitaria 1200, Lima', segment: 'Nuevo', status: 'active', created_at: '2026-09-01T08:20:00Z', purchase_count: 2, total_purchased: 132.0 },
  { id: 23, document_type: 'DNI', document_number: '45678123', name: 'Elena Quispe', email: 'elena.quispe@correo.com', phone: '+51966223344', address: 'Av. El Sol 945, Cusco', segment: 'Ocasional', status: 'inactive', created_at: '2025-10-14T13:00:00Z', purchase_count: 5, total_purchased: 392.5 },
  { id: 24, document_type: 'DNI', document_number: '73985412', name: 'Ricardo Soto', email: 'ricardo.soto@correo.com', phone: '+51988556677', address: 'Av. Argentina 1250, Callao', segment: 'Recurrente', status: 'inactive', created_at: '2026-01-17T11:30:00Z', purchase_count: 8, total_purchased: 610.9 },
]

/** Segmentos disponibles para filtros y formulario. */
export const CUSTOMER_SEGMENTS = SEGMENTS

let customers: Customer[] = SEED.map((seed) => ({ ...seed }))

/** Latencia simulada para ver los estados de carga (txt §8). */
const delay = (ms = 400): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface CustomerFilters {
  search?: string
  segment?: string
  status?: 'active' | 'inactive' | ''
}

export async function listCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return customers.filter(
    (customer) =>
      (!filters.status || customer.status === filters.status) &&
      (!filters.segment || customer.segment === filters.segment) &&
      (search === '' ||
        customer.name.toLowerCase().includes(search) ||
        customer.document_number.includes(search) ||
        customer.email.toLowerCase().includes(search)),
  )
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  await delay()
  // RN-01: documento único por empresa.
  if (customers.some((customer) => customer.document_number === input.document_number)) {
    throw new Error('Ya existe un cliente con ese número de documento.')
  }
  const customer: Customer = {
    id: Math.max(...customers.map((existing) => existing.id), 0) + 1,
    ...input,
    status: 'active',
    created_at: new Date().toISOString(),
    purchase_count: 0,
    total_purchased: 0,
  }
  customers = [...customers, customer]
  return customer
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  await delay()
  if (
    customers.some(
      (customer) => customer.id !== id && customer.document_number === input.document_number,
    )
  ) {
    throw new Error('Ya existe un cliente con ese número de documento.')
  }
  const existing = customers.find((customer) => customer.id === id)
  if (!existing) throw new Error('Cliente no encontrado.')
  const updated: Customer = { ...existing, ...input }
  customers = customers.map((customer) => (customer.id === id ? updated : customer))
  return updated
}

/** Baja lógica (DELETE /customers → status inactive, RF-03). */
export async function deactivateCustomer(id: number): Promise<Customer> {
  await delay()
  const existing = customers.find((customer) => customer.id === id)
  if (!existing) throw new Error('Cliente no encontrado.')
  const updated: Customer = { ...existing, status: 'inactive' }
  customers = customers.map((customer) => (customer.id === id ? updated : customer))
  return updated
}

/** Compra del historial (mock determinista por cliente). */
export interface CustomerPurchase {
  sale_number: string
  issued_at: string
  total: number
  status: SaleStatus
}

const HISTORY_STATUSES: SaleStatus[] = ['paid', 'paid', 'paid', 'pending', 'partial']

/**
 * Historial de compras (GET /customers/{id}/history).
 * TODO(Fase 05): lo servirá el backend con las ventas reales.
 */
export async function getCustomerHistory(customer: Customer): Promise<CustomerPurchase[]> {
  await delay(300)
  const count = Math.min(customer.purchase_count, 8)
  const base = customer.total_purchased / Math.max(customer.purchase_count, 1)
  return Array.from({ length: count }, (_, index) => {
    const seed = customer.id * 31 + index * 7
    const issuedAt = new Date(Date.now() - index * 12 * 24 * 60 * 60 * 1000 - seed * 3600000)
    return {
      sale_number: `V-2026-${String(1000 + seed).padStart(6, '0')}`,
      issued_at: issuedAt.toISOString(),
      total: Math.round((base * (0.6 + ((seed % 10) / 10))) * 100) / 100,
      status: HISTORY_STATUSES[seed % HISTORY_STATUSES.length],
    }
  })
}
