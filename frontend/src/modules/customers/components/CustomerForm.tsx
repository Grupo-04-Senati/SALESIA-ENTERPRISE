import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer, CustomerInput } from '@/types/customer'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/form'
import { digits, email, minLength, required, validateForm } from '@/utils/validators'
import type { FormErrors, FormRules, Validator } from '@/utils/validators'
import { CUSTOMER_SEGMENTS } from '../services/customerService'

/**
 * Formulario de cliente crear/editar en modal (RF-03).
 * Validación con utils/validators (Fase 06).
 */

interface CustomerFormProps {
  open: boolean
  onClose: () => void
  /** Cliente a editar; `null` = crear nuevo. */
  customer: Customer | null
  /** Envía los datos ya validados (el componente del padre persiste). */
  onSubmit: (input: CustomerInput) => Promise<void>
}

interface FormValues extends Record<string, string> {
  document_type: string
  document_number: string
  name: string
  email: string
  phone: string
  address: string
  segment: string
}

const DOCUMENT_TYPES = ['DNI', 'RUC', 'CE']

const EMPTY: FormValues = {
  document_type: 'DNI',
  document_number: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  segment: 'Nuevo',
}

export default function CustomerForm({ open, onClose, customer, onSubmit }: CustomerFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<FormValues>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(
      customer
        ? {
            document_type: customer.document_type,
            document_number: customer.document_number,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            segment: customer.segment,
          }
        : EMPTY,
    )
  }, [open, customer])

  const setValue = (key: keyof FormValues) => (event: { target: { value: string } }) => {
    const value = event.target.value
    setValues((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  const phoneRule: Validator = (value) =>
    !value.trim() || /^\+?\d{7,15}$/.test(value.trim()) ? null : 'Teléfono inválido'

  const documentNumberRule: Validator = (value) => {
    if (values.document_type === 'DNI') return digits(8, 'El DNI debe tener 8 dígitos')(value)
    if (values.document_type === 'RUC') return digits(11, 'El RUC debe tener 11 dígitos')(value)
    return minLength(6, 'Ingresa un documento válido')(value)
  }

  const rules: FormRules<FormValues> = {
    document_number: (value) => required('El documento es obligatorio')(value) ?? documentNumberRule(value),
    name: (value) => required()(value) ?? minLength(3, 'Ingresa el nombre completo')(value),
    email: email(),
    phone: phoneRule,
    segment: required(),
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateForm(values, rules)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({
        document_type: values.document_type,
        document_number: values.document_number.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        segment: values.segment,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Editar cliente' : 'Nuevo cliente'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="customer-form" loading={submitting}>
            {customer ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo de documento"
          required
          value={values.document_type}
          onChange={setValue('document_type')}
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>

        <Input
          label="Número de documento"
          required
          inputMode="numeric"
          placeholder="74125896"
          value={values.document_number}
          onChange={setValue('document_number')}
          error={errors.document_number}
        />

        <div className="sm:col-span-2">
          <Input
            label="Nombre o razón social"
            required
            placeholder="María Quispe"
            value={values.name}
            onChange={setValue('name')}
            error={errors.name}
          />
        </div>

        <Input
          label="Correo electrónico"
          type="email"
          placeholder="maria@correo.com"
          value={values.email}
          onChange={setValue('email')}
          error={errors.email}
        />

        <Input
          label="Teléfono"
          placeholder="+51987654321"
          value={values.phone}
          onChange={setValue('phone')}
          error={errors.phone}
        />

        <div className="sm:col-span-2">
          <Select
            label="Segmento"
            required
            value={values.segment}
            onChange={setValue('segment')}
            error={errors.segment}
          >
            {CUSTOMER_SEGMENTS.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Textarea
            label="Dirección"
            placeholder="Av. Los Olivos 123, Lima"
            value={values.address}
            onChange={setValue('address')}
          />
        </div>
      </form>
    </Modal>
  )
}
