/**
 * Une clases condicionales — sustituto ligero de clsx
 * para no añadir dependencias solo para esto.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
