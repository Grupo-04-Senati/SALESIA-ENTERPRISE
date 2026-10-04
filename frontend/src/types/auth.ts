/**
 * Tipos de autenticación y usuarios (docs/05_api.md §2.1–2.2).
 */

/** Roles del sistema (columna "Acceso" de docs/05_api.md). */
export type Role = 'Admin' | 'Gerente' | 'Vendedor' | 'Analista' | 'Almacén'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  /** Foto de perfil (data-URI) o null si no tiene. */
  avatar?: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}
