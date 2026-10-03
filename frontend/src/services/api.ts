/**
 * Cliente HTTP para la API de SalesIA (docs/05_api.md).
 * Instancia Axios con interceptores: token Bearer en cada petición,
 * cierre de sesión automático en 401 y errores normalizados al
 * formato estándar {code, message, detail} (docs/05 §3).
 */

import axios, { AxiosError, type AxiosInstance } from 'axios'

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

interface ApiErrorBody {
  code?: string
  message?: string
  detail?: string
}

/** Instancia Axios compartida (baseURL + Content-Type JSON). */
const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

/** Interceptor de petición: adjunta el token Bearer cuando existe. */
http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Convierte un error de Axios al formato de error estándar de la API. */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  const axiosError = error as AxiosError<ApiErrorBody>
  const status = axiosError.response?.status ?? 0
  const body = axiosError.response?.data
  const code = body?.code ?? (status ? 'INTERNAL_ERROR' : 'NETWORK_ERROR')
  const message =
    body?.message ?? (typeof body?.detail === 'string' ? body.detail : undefined) ??
    axiosError.message ?? `Error ${status}`
  return new ApiError(message, status, code)
}

/** Interceptor de respuesta: cierra la sesión en 401 y normaliza errores. */
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as AxiosError<ApiErrorBody>
    const status = axiosError.response?.status
    const path = axiosError.config?.url ?? ''

    // Sesión vencida o inválida: se cierra y se vuelve al login (docs/05 §2.1).
    if (status === 401 && !path.startsWith('/api/v1/auth/')) {
      clearToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login')
      }
    }

    return Promise.reject(toApiError(error))
  },
)

/** GET/POST/PUT/PATCH/DELETE genérico con token Bearer. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await http.request<T>({
      url: path,
      method: init.method ?? 'GET',
      data: init.body,
      ...(init.headers ? { headers: init.headers as Record<string, string> } : {}),
    })

    if (response.status === 204 || response.data === ('' as unknown as T)) {
      return undefined as T
    }
    return response.data
  } catch (error) {
    throw toApiError(error)
  }
}
