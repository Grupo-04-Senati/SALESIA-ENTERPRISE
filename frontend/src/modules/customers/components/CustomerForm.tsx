import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer, CustomerInput } from '@/types/customer'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/form'
import { digits, email, minLength, required, validateForm } from '@/utils/validators'
import type { FormErrors, FormRules, Validator } from '@/utils/validators'
import { CUSTOMER_SEGMENTS, SEGMENT_KEYS } from '../services/customerService'
import { useLang } from '@/i18n/i18n'

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
  const { t } = useLang()
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
    !value.trim() || /^\+?\d{7,15}$/.test(value.trim()) ? null : t('customers.telefono-invalido')

  const documentNumberRule: Validator = (value) => {
    if (values.document_type === 'DNI')
      return digits(8, t('customers.el-dni-debe-tener-8-digitos'))(value)
    if (values.document_type === 'RUC')
      return digits(11, t('customers.el-ruc-debe-tener-11-digitos'))(value)
    return minLength(6, t('customers.ingresa-un-documento-valido'))(value)
  }

  const rules: FormRules<FormValues> = {
    document_number: (value) =>
      required(t('customers.el-documento-es-obligatorio'))(value) ?? documentNumberRule(value),
    name: (value) =>
      required(t('customers.campo-obligatorio'))(value) ??
      minLength(3, t('customers.ingresa-el-nombre-completo'))(value),
    email: email(t('customers.ingresa-un-correo-valido')),
    phone: phoneRule,
    segment: required(t('customers.campo-obligatorio')),
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
      title={customer ? t('customers.editar-cliente') : t('customers.nuevo-cliente')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('customers.cancelar')}
          </Button>
          <Button type="submit" form="customer-form" loading={submitting}>
            {customer ? t('customers.guardar-cambios') : t('customers.crear-cliente')}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('customers.tipo-de-documento')}
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
          label={t('customers.numero-de-documento')}
          required
          inputMode="numeric"
          placeholder="74125896"
          value={values.document_number}
          onChange={setValue('document_number')}
          error={errors.document_number}
        />

        <div className="sm:col-span-2">
          <Input
            label={t('customers.nombre-o-razon-social')}
            required
            placeholder="María Quispe"
            value={values.name}
            onChange={setValue('name')}
            error={errors.name}
          />
        </div>

        <Input
          label={t('customers.correo-electronico')}
          type="email"
          placeholder="maria@correo.com"
          value={values.email}
          onChange={setValue('email')}
          error={errors.email}
        />

        <Input
          label={t('customers.telefono')}
          placeholder="+51987654321"
          value={values.phone}
          onChange={setValue('phone')}
          error={errors.phone}
        />

        <div className="sm:col-span-2">
          <Select
            label={t('customers.segmento')}
            required
            value={values.segment}
            onChange={setValue('segment')}
            error={errors.segment}
          >
            {CUSTOMER_SEGMENTS.map((segment) => (
              <option key={segment} value={segment}>
                {t(SEGMENT_KEYS[segment] ?? segment)}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Textarea
            label={t('customers.direccion')}
            placeholder="Av. Los Olivos 123, Lima"
            value={values.address}
            onChange={setValue('address')}
          />
        </div>
      </form>
    </Modal>
  )
}
