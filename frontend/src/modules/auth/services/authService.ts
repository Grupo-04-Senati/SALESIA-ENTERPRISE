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

/** POST /auth/login — guarda token y usuario de la sesión. */
export async function login({ email, password }: DemoLogin): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>(ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  })
  setToken(response.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  return response
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
