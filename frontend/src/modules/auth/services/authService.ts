import type { LoginResponse, Role, User } from '@/types/auth'

/**
 * Servicio de autenticación en modo demostración (Fase 03).
 * TODO(Fase 05): sustituir por POST /api/v1/auth/login y guardar el
 * access token (docs/05_api.md §2.1). Hasta entonces cualquier correo
 * y contraseña válidos abren la sesión.
 */

const SESSION_KEY = 'salesia_demo_user'

/** Usuario demo por defecto (rol Admin para poder revisar todo el sistema). */
export const DEMO_USER: User = {
  id: 1,
  name: 'Ana Torres',
  email: 'ana@salesia.pe',
  role: 'Admin',
}

const delay = (ms = 350): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface DemoLogin {
  email: string
  password: string
}

export async function login({ email }: DemoLogin): Promise<LoginResponse> {
  await delay()
  const user: User = { ...DEMO_USER, email: email.trim() || DEMO_USER.email }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  return {
    access_token: 'demo-token',
    refresh_token: 'demo-refresh',
    token_type: 'bearer',
    expires_in: 1800,
    user,
  }
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/** Usuario de la sesión actual; por defecto el usuario demo. */
export function getCurrentUser(): User {
  const stored = sessionStorage.getItem(SESSION_KEY)
  if (!stored) return DEMO_USER
  try {
    return JSON.parse(stored) as User
  } catch {
    return DEMO_USER
  }
}

/** Roles del sistema (docs/05_api.md §2.2). */
export const ROLES: Role[] = ['Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén']

/** Usuarios de demostración para la vista de gestión (baja lógica, RF-02). */
export interface ManagedUser extends User {
  status: 'active' | 'inactive'
}

export const MANAGED_USERS: ManagedUser[] = [
  { id: 1, name: 'Ana Torres', email: 'ana@salesia.pe', role: 'Admin', status: 'active' },
  { id: 2, name: 'Luis Ríos', email: 'luis.rios@salesia.pe', role: 'Vendedor', status: 'active' },
  { id: 3, name: 'Carlos Peña', email: 'carlos.pena@salesia.pe', role: 'Almacén', status: 'active' },
  { id: 4, name: 'Rosa Huamán', email: 'rosa.huaman@salesia.pe', role: 'Analista', status: 'active' },
  { id: 5, name: 'Jorge Ramírez', email: 'jorge.ramirez@salesia.pe', role: 'Vendedor', status: 'inactive' },
  { id: 6, name: 'Elena Quispe', email: 'elena.quispe@salesia.pe', role: 'Gerente', status: 'active' },
]
