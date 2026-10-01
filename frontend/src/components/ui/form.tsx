import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Controles de formulario (txt §5.2): campo con etiqueta/error,
 * input, textarea, select con chevron y checkbox/radio.
 */

interface FieldProps {
  label?: string
  htmlFor?: string
  /** Mensaje de error (borde rojo + texto, txt §5.2). */
  error?: string
  /** Ayuda secundaria cuando no hay error. */
  hint?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-body-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, required, className, id, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('input', error && 'input-error', className)}
        {...rest}
      />
    </Field>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, required, className, id, ...rest }: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <textarea
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn('input min-h-[100px]', error && 'input-error', className)}
        {...rest}
      />
    </Field>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

/** Select con chevron gris a la derecha (txt §5.2). */
export function Select({ label, error, hint, required, className, id, children, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} required={required}>
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn('input appearance-none pr-10', error && 'input-error', className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
      </div>
    </Field>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  className?: string
}

/** Checkbox de 18 px con color activo azul corporativo (txt §5.2). */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-body-sm text-gray-700', className)}>
      <input type="checkbox" className="h-[18px] w-[18px] shrink-0 accent-primary" {...rest} />
      {label && <span>{label}</span>}
    </label>
  )
}

/** Radio de 18 px con color activo azul corporativo (txt §5.2). */
export function Radio({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-body-sm text-gray-700', className)}>
      <input type="radio" className="h-[18px] w-[18px] shrink-0 accent-primary" {...rest} />
      {label && <span>{label}</span>}
    </label>
  )
}
