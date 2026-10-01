/**
 * Cliente HTTP para la API de SalesIA (docs/05_api.md).
 * TODO(Fase 05): probar contra el backend FastAPI; mientras tanto,
 * los módulos consumen datos mock con la misma forma que las
 * respuestas reales y este cliente queda listo para conectarlos.
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

const TOKEN_KEY = 'salesia_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

/**
 * GET/POST/PUT genérico con token Bearer y manejo del
 * formato de error estándar (docs/05_api.md §3).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(path, {
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
      message = body.message ?? body.detail ?? message
    } catch {
      // Respuesta sin cuerpo JSON — se conserva el mensaje genérico.
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
