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

/**
 * Normaliza un texto de usuario: recorta los extremos y colapsa los
 * espacios internos repetidos ("  hola   mundo " → "hola mundo").
 * Usar antes de validar y de enviar al backend.
 */
export const cleanText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ')

/** Debe contener al menos una letra (rechaza "###", "---", "123", "@@"). */
export const hasLetter =
  (message = 'Debe contener al menos una letra'): Validator =>
  (value) =>
    value.trim().length === 0 || /\p{L}/u.test(value.trim()) ? null : message

/** El valor (recortado) debe coincidir con la expresión indicada. */
export const pattern =
  (re: RegExp, message = 'Formato no válido'): Validator =>
  (value) =>
    value.trim().length === 0 || re.test(value.trim()) ? null : message

/** Entre `min` y `max` dígitos (documentos: DNI=8, RUC=11, CE 6..12). */
export const digitsBetween =
  (min: number, max: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    return new RegExp(`^\\d{${min},${max}}$`).test(v)
      ? null
      : (message ?? `Debe tener entre ${min} y ${max} dígitos`)
  }

/** Teléfono: 7 a 15 dígitos con `+` opcional al inicio (sin espacios). */
export const phone =
  (message = 'Teléfono inválido: de 7 a 15 dígitos'): Validator =>
  (value) => {
    const v = value.trim()
    return v.length === 0 || /^\+?\d{7,15}$/.test(v) ? null : message
  }

/** Número entero dentro de [min, max] (cantidades, stock, etc.). */
export const integer =
  (min: number, max: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    const n = Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n))
      return message ?? 'Debe ser un número entero'
    return n >= min && n <= max
      ? null
      : (message ?? `Debe ser un entero entre ${min} y ${max}`)
  }

/** Máximo de decimales permitidos (precios: 2). */
export const maxDecimals =
  (places: number, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    const dot = v.indexOf('.')
    if (dot === -1) return null
    return v.length - dot - 1 <= places
      ? null
      : (message ?? `Máximo ${places} decimales`)
  }

/** Código alfanumérico: letras, dígitos, punto, guion o guion bajo (1..max). */
export const code =
  (max = 50, message?: string): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    return new RegExp(`^[A-Za-z0-9][A-Za-z0-9._\\-]{0,${max - 1}}$`).test(v)
      ? null
      : (message ?? `Sólo letras, dígitos, punto o guion (máx. ${max})`)
  }

/**
 * Fecha (YYYY-MM-DD o parseable) no anterior a hoy.
 * Para campos como "válido hasta", "próxima ejecución".
 */
export const notPastDate =
  (message = 'La fecha no puede ser anterior a hoy'): Validator =>
  (value) => {
    const v = value.trim()
    if (v.length === 0) return null
    const d = new Date(`${v.slice(0, 10)}T00:00:00`)
    if (Number.isNaN(d.getTime())) return message
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d >= today ? null : message
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
