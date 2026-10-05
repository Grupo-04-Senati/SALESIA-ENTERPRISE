import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { MovementType } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/form'
import { cleanText, integer, maxLength, minNumber, required, validateForm } from '@/utils/validators'
import type { FormErrors, FormRules } from '@/utils/validators'
import { useLang } from '@/i18n/i18n'
import type { MovementInput } from '../services/inventoryService'
import type { StockRow } from '../services/inventoryService'

/**
 * Registro de movimiento de inventario (RF-08): entrada, salida,
 * devolución, merma o ajuste. Merma y ajuste exigen motivo (RN-21).
 */

interface MovementFormProps {
  open: boolean
  onClose: () => void
  stock: StockRow[]
  onSubmit: (input: MovementInput) => Promise<void>
}

interface FormValues extends Record<string, string> {
  product_id: string
  type: string
  quantity: string
  reason: string
}

const TYPES: MovementType[] = ['IN', 'OUT', 'RETURN', 'SHRINKAGE', 'ADJUSTMENT']

const EMPTY: FormValues = { product_id: '', type: 'IN', quantity: '1', reason: '' }

const MOVEMENT_KEYS: Record<MovementType, string> = {
  IN: 'inventory.entrada',
  OUT: 'inventory.salida',
  RETURN: 'inventory.devolucion',
  SHRINKAGE: 'inventory.merma',
  ADJUSTMENT: 'inventory.ajuste',
}

export default function MovementForm({ open, onClose, stock, onSubmit }: MovementFormProps) {
  const { t } = useLang()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<FormValues>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(EMPTY)
    setErrors({})
  }, [open])

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

  const needsReason = values.type === 'SHRINKAGE' || values.type === 'ADJUSTMENT'

  const rules: FormRules<FormValues> = {
    product_id: required(t('inventory.selecciona-un-producto')),
    quantity: (value) =>
      required()(value) ??
      minNumber(1, t('inventory.la-cantidad-debe-ser-mayor-a-cero'))(value) ??
      integer(1, 999999)(value),
    reason: (value) =>
      (needsReason
        ? required(t('inventory.ingresa-el-motivo-obligatorio-en-merma-y-ajuste'))(value)
        : null) ?? maxLength(255)(value),
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateForm(values, rules)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({
        product_id: Number(values.product_id),
        type: values.type as MovementType,
        quantity: Number(values.quantity),
        reason: cleanText(values.reason),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('inventory.registrar-movimiento')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('inventory.cancelar')}
          </Button>
          <Button type="submit" form="movement-form" loading={submitting}>
            {t('inventory.registrar')}
          </Button>
        </>
      }
    >
      <form id="movement-form" onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={t('inventory.producto')}
          required
          value={values.product_id}
          onChange={setValue('product_id')}
          error={errors.product_id}
        >
          <option value="">{t('inventory.selecciona-un-producto-2')}</option>
          {stock.map((row) => (
            <option key={row.product_id} value={row.product_id}>
              {row.name} ({row.sku}) — {row.current_stock} {row.unit}
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('inventory.tipo-de-movimiento')}
            value={values.type}
            onChange={setValue('type')}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(MOVEMENT_KEYS[type])}
              </option>
            ))}
          </Select>
          <Input
            label={t('inventory.cantidad')}
            required
            type="number"
            min="1"
            max="999999"
            step="1"
            inputMode="numeric"
            value={values.quantity}
            onChange={setValue('quantity')}
            error={errors.quantity}
          />
        </div>

        <Textarea
          label={t('inventory.motivo')}
          required={needsReason}
          maxLength={255}
          placeholder={
            needsReason
              ? t('inventory.obligatorio-para-merma-y-ajuste-rn-21')
              : t('inventory.opcional-receipt-venta-devolucion')
          }
          value={values.reason}
          onChange={setValue('reason')}
          error={errors.reason}
        />
      </form>
    </Modal>
  )
}
