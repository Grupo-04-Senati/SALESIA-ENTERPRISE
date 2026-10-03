import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@/types/auth'
import { getCurrentUser, login as loginApi, logout as logoutApi } from '@/modules/auth/services/authService'

/**
 * Estado de sesión del usuario (Fase 05 — API FastAPI, docs/05 §2.1).
 * El token y el usuario se guardan en services/api.ts y authService.ts.
 */
export function useAuth() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(() => getCurrentUser())

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginApi({ email, password })
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(() => {
    logoutApi()
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
