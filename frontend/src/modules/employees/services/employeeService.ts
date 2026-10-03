import type { Employee, EmployeeInput } from '@/types/employee'
import { apiFetch } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import { hydrateStore } from '@/services/hydrate'

/**
 * Servicio de vendedores/empleados contra la API (docs/05 §2.5 · RF-05).
 * Tras cada escritura se refresca el almacén para que el formulario de
 * ventas (selector de vendedor) y los filtros los vean.
 */

interface Page<T> {
  items: T[]
}

export async function listEmployees(): Promise<Employee[]> {
  const page = await apiFetch<Page<Employee>>(
    `${ENDPOINTS.employees}?page=1&page_size=100&metrics=true`,
  )
  return [...page.items].sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const employee = await apiFetch<Employee>(ENDPOINTS.employees, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await hydrateStore(['sellers'])
  return employee
}

export async function updateEmployee(id: number, input: EmployeeInput): Promise<Employee> {
  const employee = await apiFetch<Employee>(`${ENDPOINTS.employees}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  await hydrateStore(['sellers'])
  return employee
}

/** Normaliza el formulario: vacíos a null (la API no admite '' en email). */
export function toEmployeeInput(form: {
  full_name: string
  document: string
  position: string
  phone: string
  email: string
  hire_date: string
}): EmployeeInput {
  return {
    full_name: form.full_name.trim(),
    document: form.document.trim() || null,
    position: form.position.trim() || 'Vendedor',
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    hire_date: form.hire_date || null,
  }
}
