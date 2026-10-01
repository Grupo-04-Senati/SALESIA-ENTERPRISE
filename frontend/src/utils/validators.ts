/**
 * Validadores de formulario (plan Fase 06 — formularios con validación).
 *
 * Cada fábrica devuelve un validador `(valor) => mensaje | null`.
 * Convención: los validadores IGNORAN el campo vacío (para eso está
 * `required`); se combinan encadenando en las reglas del formulario.
 * Los valores se reciben como string (propios de los inputs).
 */

export type Validator = (value: string) => string | null

/** Campo obligatorio (no vacío tras recortar espacios). */
export const required =
  (message = 'Este campo es obligatorio'): Validator =>
  (value) =>
    value.trim().length > 0 ? null : message

/** Correo electrónico con formato válido. */
export const email =
  (message = 'Ingresa un correo válido'): Validator =>
  (value) =>
    value.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
      ? null
      : message

/** Longitud mínima de caracteres (sobre el valor recortado). */
export const minLength =
  (min: number, message?: string): Validator =>
  (value) =>
    value.trim().length === 0 || value.trim().length >= min
      ? null
      : (message ?? `Debe tener al menos ${min} caracteres`)

/** Longitud máxima de caracteres. */
export const maxLength =
  (max: number, message?: string): Validator =>
  (value) =>
    value.trim().length === 0 || value.trim().length <= max
      ? null
      : (message ?? `Debe tener como máximo ${max} caracteres`)

/** Exactamente N dígitos (DNI = 8, RUC = 11). */
export const digits =
  (count: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    return v.length === 0 || new RegExp(`^\\d{${count}}$`).test(v)
      ? null
      : (message ?? `Debe tener ${count} dígitos`)
  }

/** Valor numérico mayor o igual a `min`. */
export const minNumber =
  (min: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    const n = Number(v)
    if (Number.isNaN(n)) return message ?? 'Debe ser un número'
    return n >= min ? null : (message ?? `Debe ser mayor o igual a ${min}`)
  }

/** Valor numérico dentro del rango [min, max]. */
export const numberRange =
  (min: number, max: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    const n = Number(v)
    if (Number.isNaN(n)) return message ?? 'Debe ser un número'
    return n >= min && n <= max
      ? null
      : (message ?? `Debe estar entre ${min} y ${max}`)
  }

/** Reglas por campo de un formulario. */
export type FormRules<T extends Record<string, string>> = {
  [K in keyof T]?: Validator
}

/** Errores por campo (undefined = sin error). */
export type FormErrors<T extends Record<string, string>> = {
  [K in keyof T]?: string
}

/**
 * Valida todos los campos con sus reglas y devuelve solo los errores.
 * `errors` vacío ⇒ formulario válido.
 */
export function validateForm<T extends Record<string, string>>(
  values: T,
  rules: FormRules<T>,
): FormErrors<T> {
  const errors: FormErrors<T> = {}
  for (const key of Object.keys(rules) as Array<keyof T>) {
    const rule = rules[key]
    if (!rule) continue
    const error = rule(values[key])
    if (error) errors[key] = error
  }
  return errors
}
