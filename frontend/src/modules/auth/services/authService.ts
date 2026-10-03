import { apiFetch, clearToken, getToken, setToken } from '@/services/api'
import { ENDPOINTS } from '@/services/endpoints'
import type { LoginResponse, Role, User } from '@/types/auth'

/**
 * Servicio de autenticación contra la API (Fase 05 · docs/05_api.md §2.1).
 * El access token queda en localStorage y se adjunta en cada petición
 * (services/api.ts); el usuario de la sesión se conserva para el encabezado.
 */

const USER_KEY = 'salesia_user'

export interface DemoLogin {
  email: string
  password: string
}

/** Guarda el usuario de sesión y notifica a la app (header, perfil, etc.). */
export function setCurrentUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event('salesia:user'))
}

/** POST /auth/login — guarda token y usuario de la sesión. */
export async function login({ email, password }: DemoLogin): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>(ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  })
  setToken(response.access_token)
  setCurrentUser(response.user)
  return response
}

/** GET /auth/me — valida la sesión contra la API y actualiza el usuario. */
export async function fetchMe(): Promise<User> {
  const me = await apiFetch<User>(ENDPOINTS.auth.me)
  setCurrentUser(me)
  return me
}

/** PUT /users/{id} — actualiza el nombre del propio perfil (RF-02). */
export async function updateProfileName(userId: number, fullName: string): Promise<User> {
  const updated = await apiFetch<User>(`${ENDPOINTS.users}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ full_name: fullName }),
  })
  setCurrentUser(updated)
  return updated
}

/** POST /auth/logout (best effort) y cierre de la sesión local. */
export function logout(): void {
  const token = getToken()
  if (token) {
    apiFetch(ENDPOINTS.auth.logout, { method: 'POST' }).catch(() => {
      // El JWT es stateless: si el backend no responde se cierra igual.
    })
  }
  clearToken()
}

/** Usuario de la sesión actual (null si no hay sesión iniciada). */
export function getCurrentUser(): User | null {
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

/** Cierra la sesión local y notifica a la app. */
export function clearCurrentUser(): void {
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('salesia:user'))
}

/** Roles del sistema (docs/05_api.md §2.2). */
export const ROLES: Role[] = ['Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén']

/** Usuarios de la gestión de usuarios (RF-02 · GET /users, solo Admin). */
export interface ManagedUser extends User {
  status: 'active' | 'inactive'
  last_login?: string | null
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const page = await apiFetch<{ items: ManagedUser[] }>(
    `${ENDPOINTS.users}?page=1&page_size=100`,
  )
  return page.items
}
