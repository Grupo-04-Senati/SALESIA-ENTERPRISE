/**
 * Cliente HTTP para la API de SalesIA (docs/05_api.md).
 * Token Bearer + manejo del formato de error estándar (docs/05 §3).
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** URL base del backend (VITE_API_URL o localhost:8000 en desarrollo). */
export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

const TOKEN_KEY = 'salesia_token'
const USER_KEY = 'salesia_user'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** GET/POST/PUT/PATCH/DELETE genérico con token Bearer. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    let code = 'INTERNAL_ERROR'
    let message = `Error ${response.status}`
    try {
      const body = (await response.json()) as { code?: string; message?: string; detail?: string }
      code = body.code ?? code
      message = body.message ?? (typeof body.detail === 'string' ? body.detail : message)
    } catch {
      // Respuesta sin cuerpo JSON — se conserva el mensaje genérico.
    }

    // Sesión vencida o inválida: se cierra y se vuelve al login (docs/05 §2.1).
    if (response.status === 401 && !path.startsWith('/api/v1/auth/')) {
      clearToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login')
      }
    }

    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
