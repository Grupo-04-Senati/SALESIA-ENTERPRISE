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

/** PATCH /auth/profile — actualiza nombre y/o foto del propio perfil (cualquier rol). */
export interface ProfileInput {
  full_name?: string
  /** Data-URI de la foto; '' la elimina. */
  avatar?: string | null
}

export async function updateProfile(input: ProfileInput): Promise<User> {
  const updated = await apiFetch<User>(ENDPOINTS.auth.profile, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  setCurrentUser(updated)
  return updated
}

/** PATCH /auth/password — cambia la propia contraseña (valida la actual). */
export async function changePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  await apiFetch(ENDPOINTS.auth.password, {
    method: 'PATCH',
    body: JSON.stringify({ current_password, new_password }),
  })
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

/** Datos para crear un usuario (RF-02 · POST /users, solo Admin). */
export interface CreateUserInput {
  full_name: string
  email: string
  password: string
  role: Role
}

/** POST /users — crea un usuario nuevo con rol y contraseña iniciales. */
export async function createManagedUser(input: CreateUserInput): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(ENDPOINTS.users, {
    method: 'POST',
    body: JSON.stringify({ ...input, status: 'active' }),
  })
}

/** Datos para que el Admin edite un usuario (PUT /users/{id}). */
export interface UpdateManagedUserInput {
  full_name?: string
  role?: Role
  /** contraseña nueva; si se omite o va vacía no se modifica. */
  password?: string
  status?: 'active' | 'inactive'
}

/** PUT /users/{id} — el Admin modifica nombre, rol, estado y/o contraseña. */
export async function updateManagedUser(
  userId: number,
  input: UpdateManagedUserInput,
): Promise<ManagedUser> {
  const payload: Record<string, string> = {}
  if (input.full_name) payload.full_name = input.full_name
  if (input.role) payload.role = input.role
  if (input.password) payload.password = input.password
  if (input.status) payload.status = input.status
  return apiFetch<ManagedUser>(`${ENDPOINTS.users}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
