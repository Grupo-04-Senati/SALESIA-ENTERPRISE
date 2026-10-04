export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'salesia-theme'

/** Tema vigente (localStorage; si no existe, prefiere el del sistema). */
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* localStorage no disponible */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Aplica el tema en <html class="dark"> y lo persiste. */
export function applyTheme(theme: Theme): Theme {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* localStorage no disponible */
  }
  return theme
}

/** Invierte el tema actual y lo persiste. Devuelve el nuevo tema. */
export function toggleTheme(): Theme {
  const isDark = document.documentElement.classList.contains('dark')
  return applyTheme(isDark ? 'light' : 'dark')
}
