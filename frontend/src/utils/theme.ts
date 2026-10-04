export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'salesia-theme'

/** Tema vigente. Por defecto claro; solo respeta lo guardado por el usuario. */
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    // Sin preferencia guardada: claro y se persiste para la próxima carga.
    localStorage.setItem(STORAGE_KEY, 'light')
  } catch {
    /* localStorage no disponible */
  }
  return 'light'
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
