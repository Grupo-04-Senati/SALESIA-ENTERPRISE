import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer, CustomerInput } from '@/types/customer'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/form'
import { cleanText, digits, email, hasLetter, maxLength, minLength, phone, required, validateForm } from '@/utils/validators'
import type { FormErrors, FormRules, Validator } from '@/utils/validators'
import { CUSTOMER_SEGMENTS, SEGMENT_KEYS, lookupDocument } from '../services/customerService'
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
  commercial_line: string
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
  commercial_line: '',
}

export default function CustomerForm({ open, onClose, customer, onSubmit }: CustomerFormProps) {
  const { t } = useLang()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<FormValues>>({})
  const [submitting, setSubmitting] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupHint, setLookupHint] = useState('')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setLookupHint('')
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
            commercial_line: customer.commercial_line ?? '',
          }
        : EMPTY,
    )
  }, [open, customer])

  const handleLookup = async () => {
    const document = values.document_number.trim()
    if (document.length < 6) {
      setLookupHint(t('customers.ingresa-un-documento-valido'))
      return
    }
    setLookingUp(true)
    setLookupHint('')
    try {
      const result = await lookupDocument(document)
      if (result.found && result.name) {
        setValues((previous) => ({
          ...previous,
          document_type: result.document_type || previous.document_type,
          name: result.name,
          address: result.address || previous.address,
        }))
        setLookupHint(
          result.source === 'local'
            ? t('customers.cliente-existente-en-la-base')
            : t('customers.datos-completados-desde-la-api'),
        )
      } else {
        setLookupHint(t('customers.documento-no-encontrado-completa-a-mano'))
      }
    } catch {
      setLookupHint(t('customers.consulta-no-disponible-completa-a-mano'))
    } finally {
      setLookingUp(false)
    }
  }

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

  const documentNumberRule: Validator = (value) => {
    if (values.document_type === 'DNI')
      return digits(8, t('customers.el-dni-debe-tener-8-digitos'))(value)
    if (values.document_type === 'RUC')
      return digits(11, t('customers.el-ruc-debe-tener-11-digitos'))(value)
    return minLength(6, t('customers.ingresa-un-documento-valido'))(value)
  }

  const rules: FormRules<FormValues> = {
    document_number: (value) =>
      required(t('customers.el-documento-es-obligatorio'))(value) ??
      documentNumberRule(value) ??
      maxLength(20)(value),
    name: (value) =>
      required(t('customers.campo-obligatorio'))(value) ??
      minLength(3, t('customers.ingresa-el-nombre-completo'))(value) ??
      maxLength(150)(value) ??
      hasLetter()(value),
    email: (value) => email(t('customers.ingresa-un-correo-valido'))(value) ?? maxLength(160)(value),
    phone: phone(t('customers.telefono-invalido')),
    address: maxLength(255),
    segment: required(t('customers.campo-obligatorio')),
    commercial_line: maxLength(80),
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
        name: cleanText(values.name),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: cleanText(values.address),
        segment: values.segment,
        commercial_line: values.commercial_line.trim() || undefined,
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
          maxLength={20}
          placeholder="74125896"
          value={values.document_number}
          onChange={setValue('document_number')}
          error={errors.document_number}
        />

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={handleLookup} loading={lookingUp}>
            {t('customers.buscar-documento')}
          </Button>
          {lookupHint && <p className="text-caption text-gray-500">{lookupHint}</p>}
        </div>

        <div className="sm:col-span-2">
          <Input
            label={t('customers.nombre-o-razon-social')}
            required
            minLength={3}
            maxLength={150}
            placeholder="María Quispe"
            value={values.name}
            onChange={setValue('name')}
            error={errors.name}
          />
        </div>

        <Input
          label={t('customers.correo-electronico')}
          type="email"
          maxLength={160}
          placeholder="maria@correo.com"
          value={values.email}
          onChange={setValue('email')}
          error={errors.email}
        />

        <Input
          label={t('customers.telefono')}
          maxLength={20}
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
          <Input
            label={t('customers.linea-comercial')}
            maxLength={80}
            placeholder={t('customers.linea-comercial-ejemplo')}
            value={values.commercial_line}
            onChange={setValue('commercial_line')}
            error={errors.commercial_line}
          />
        </div>

        <div className="sm:col-span-2">
          <Textarea
            label={t('customers.direccion')}
            maxLength={255}
            placeholder="Av. Los Olivos 123, Lima"
            value={values.address}
            onChange={setValue('address')}
          />
        </div>
      </form>
    </Modal>
  )
}
