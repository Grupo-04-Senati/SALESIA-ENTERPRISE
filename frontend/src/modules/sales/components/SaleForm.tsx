import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SaleInput, SaleItem } from '@/types/sale'
import type { PaymentMethod } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/form'
import { formatCurrency } from '@/utils/formatters'
import {
  DEFAULT_TAX_RATE,
  SALE_CUSTOMERS,
  SALE_PRODUCTS,
  SALE_SELLERS,
  computeTotals,
} from '../services/saleService'

/**
 * Registro de venta con carrito (Fase 08 · RF-06).
 * Calcula subtotal, descuento, impuesto y total en vivo (RN-11)
 * para mostrar exactamente los importes que devolverá la API.
 */

interface SaleFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: SaleInput) => Promise<void>
}

interface CartItem {
  product_id: number
  quantity: number
  unit_price: number
  discount: number
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
]

export default function SaleForm({ open, onClose, onSubmit }: SaleFormProps) {
  const [customerId, setCustomerId] = useState('')
  const [sellerId, setSellerId] = useState(String(SALE_SELLERS[0].id))
  const [items, setItems] = useState<CartItem[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const totals = computeTotals(items, DEFAULT_TAX_RATE)

  const reset = () => {
    setCustomerId('')
    setSellerId(String(SALE_SELLERS[0].id))
    setItems([])
    setProductId('')
    setQuantity('1')
    setDiscount('0')
    setMethod('cash')
    setAmount('')
    setError(null)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const addItem = () => {
    const product = SALE_PRODUCTS.find((entry) => entry.id === Number(productId))
    if (!product) return
    const parsedQuantity = Math.max(Number(quantity) || 1, 1)
    const parsedDiscount = Math.max(Number(discount) || 0, 0)
    setItems((previous) => {
      const existing = previous.find((item) => item.product_id === product.id)
      if (existing) {
        return previous.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + parsedQuantity, discount: item.discount + parsedDiscount }
            : item,
        )
      }
      return [
        ...previous,
        { product_id: product.id, quantity: parsedQuantity, unit_price: product.sale_price, discount: parsedDiscount },
      ]
    })
    setProductId('')
    setQuantity('1')
    setDiscount('0')
    setError(null)
  }

  const removeItem = (id: number) => {
    setItems((previous) => previous.filter((item) => item.product_id !== id))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerId) {
      setError('Selecciona un cliente.')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto a la venta.')
      return
    }
    const payment = amount.trim() === '' ? totals.total : Number(amount)
    if (Number.isNaN(payment) || payment < 0) {
      setError('Ingresa un monto de pago válido.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        customer_id: Number(customerId),
        seller_id: Number(sellerId),
        items: items.map((item) => ({ ...item })),
        payment: { method, amount: payment },
        tax_rate: DEFAULT_TAX_RATE,
      })
      reset()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar venta"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="sale-form" loading={submitting}>
            Registrar venta
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente y vendedor */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Cliente"
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">Selecciona un cliente…</option>
            {SALE_CUSTOMERS.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <Select label="Vendedor" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
            {SALE_SELLERS.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Agregar producto */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-body-sm font-semibold text-gray-700">Agregar producto</p>
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Select aria-label="Producto" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Producto…</option>
                {SALE_PRODUCTS.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Cantidad"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Descuento"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button variant="secondary" onClick={addItem} className="w-full">
                Agregar
              </Button>
            </div>
          </div>
        </div>

        {/* Detalle del carrito */}
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
            Aún no agregaste productos a la venta.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {items.map((item) => {
              const product = SALE_PRODUCTS.find((entry) => entry.id === item.product_id)
              return (
                <li key={item.product_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-gray-900">{product?.name}</p>
                    <p className="text-caption text-gray-500">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                      {item.discount > 0 && ` · desc. ${formatCurrency(item.discount)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price - item.discount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product_id)}
                      aria-label={`Quitar ${product?.name}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Totales */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Descuento</span>
              <span className="font-medium text-error">− {formatCurrency(totals.discount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Impuesto (18%)</span>
              <span className="font-medium">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-h4 font-bold text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <Select label="Método de pago" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Monto pagado (S/)"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder={totals.total > 0 ? String(totals.total) : '0.00'}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              hint="Vacío = pago total"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Reexporta el tipo de línea para las vistas que la reutilicen. */
export type { SaleItem }
