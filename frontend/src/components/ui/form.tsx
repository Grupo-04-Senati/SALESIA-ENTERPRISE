import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { ChevronDown, X } from 'lucide-react'
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

export interface SearchSelectOption {
  value: string
  label: string
  /** Texto extra invisible para buscar (sku, categoría, etc.). */
  keywords?: string
}

interface SearchSelectProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  id?: string
  disabled?: boolean
  placeholder?: string
  emptyText?: string
  options: SearchSelectOption[]
  value: string
  onChange: (value: string) => void
}

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Selector con búsqueda: escribe y el desplegable filtra los resultados
 * por nombre, sku o palabras clave (sin distinguir mayúsculas ni acentos).
 * Teclado: flechas para navegar, Enter para elegir, Escape para cerrar.
 */
export function SearchSelect({
  label,
  error,
  hint,
  required,
  id,
  disabled,
  placeholder,
  emptyText,
  options,
  value,
  onChange,
}: SearchSelectProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selectedLabel = options.find((option) => option.value === value)?.label ?? ''

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim())
    if (term === '') return options
    return options.filter((option) =>
      normalizeText(`${option.label} ${option.keywords ?? ''}`).includes(term),
    )
  }, [options, query])

  const safeActive = filtered.length > 0 ? Math.min(active, filtered.length - 1) : 0

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const node = listRef.current?.children[safeActive] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [open, safeActive])

  const openList = () => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(options.findIndex((option) => option.value === value), 0))
    setOpen(true)
  }

  const choose = (option: SearchSelectOption) => {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <div className="relative" ref={wrapRef}>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered.length > 0 ? `${listId}-${safeActive}` : undefined
          }
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          disabled={disabled}
          className={cn('input pr-10', error && 'input-error')}
          placeholder={placeholder}
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={openList}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) {
                openList()
                return
              }
              if (filtered.length === 0) return
              const delta = event.key === 'ArrowDown' ? 1 : -1
              setActive((current) => (current + delta + filtered.length) % filtered.length)
              return
            }
            if (event.key === 'Enter' && open && filtered[safeActive]) {
              event.preventDefault()
              choose(filtered[safeActive])
              return
            }
            if (event.key === 'Escape' && open) {
              event.preventDefault()
              event.stopPropagation()
              setQuery('')
              setOpen(false)
            }
          }}
        />
        {value !== '' && !disabled ? (
          <button
            type="button"
            aria-label="Limpiar selección"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
        )}
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-subtle"
          >
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2.5 text-body-sm text-gray-500">{emptyText}</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(option)
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    'cursor-pointer px-3.5 py-2 text-body-sm',
                    index === safeActive
                      ? 'bg-primary text-white'
                      : option.value === value
                        ? 'bg-blue-50 font-medium text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <span className="block truncate" title={option.label}>
                    {option.label}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </Field>
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
