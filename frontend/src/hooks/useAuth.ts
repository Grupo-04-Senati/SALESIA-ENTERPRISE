import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@/types/auth'
import { getCurrentUser, login as loginDemo, logout as logoutDemo } from '@/modules/auth/services/authService'

/**
 * Estado de sesión del usuario (Fase 03 — modo demostración).
 * TODO(Fase 05): leer el token de /api/v1/auth/login, refrescarlo y
 * proteger las rutas con los roles de docs/05_api.md §2.2.
 */
export function useAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(() => getCurrentUser())

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginDemo({ email, password })
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(() => {
    logoutDemo()
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  return {
    user,
    isAuthenticated: user !== null,
    login,
    logout,
  }
}
