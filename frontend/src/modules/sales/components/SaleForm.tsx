import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { SaleInput, SaleItem } from '@/types/sale'
import type { PaymentMethod } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/form'
import { useLang } from '@/i18n/i18n'
import { integer, maxDecimals, minNumber, numberRange } from '@/utils/validators'
import { formatCurrency } from '@/utils/formatters'
import { useDataVersion } from '@/data/DataProvider'
import { lookupDocument } from '@/modules/customers/services/customerService'
import {
  DEFAULT_TAX_RATE,
  computeTotals,
  getSaleCustomers,
  getSaleProducts,
  getSaleSellers,
} from '../services/saleService'

/**
 * Registro de venta con carrito (Fase 08 · RF-06).
 * Calcula subtotal, descuento, impuesto y total en vivo (RN-11)
 * para mostrar exactamente los importes que devolverá la API.
 */

interface SaleFormProps {
  open: boolean
  onClose: () => void
  /** Envía la venta; puede devolver la traza del proceso ejecutado. */
  onSubmit: (input: SaleInput) => Promise<unknown>
}

interface CartItem {
  product_id: number
  quantity: number
  unit_price: number
  discount: number
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'sales.efectivo' },
  { value: 'card', label: 'sales.tarjeta' },
  { value: 'transfer', label: 'sales.transferencia' },
]

export default function SaleForm({ open, onClose, onSubmit }: SaleFormProps) {
  const version = useDataVersion()
  const { t } = useLang()
  // Clientes, vendedores y productos leídos del almacén compartido:
  // reflejan al instante el stock y el directorio vigentes.
  const customers = useMemo(() => getSaleCustomers(), [version])
  const sellers = useMemo(() => getSaleSellers(), [version])
  const products = useMemo(() => getSaleProducts(), [version])

  const [customerId, setCustomerId] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [items, setItems] = useState<CartItem[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Cliente nuevo (alta inline): el backend lo crea o reusa por documento.
  const [newDocType, setNewDocType] = useState('DNI')
  const [newDocNumber, setNewDocNumber] = useState('')
  const [newName, setNewName] = useState('')
  const [lookupHint, setLookupHint] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const effectiveSellerId = sellerId || (sellers[0] ? String(sellers[0].id) : '')
  const totals = computeTotals(items, DEFAULT_TAX_RATE)

  const reset = () => {
    setCustomerId('')
    setSellerId('')
    setItems([])
    setProductId('')
    setQuantity('1')
    setDiscount('0')
    setMethod('cash')
    setAmount('')
    setError(null)
    setNewDocType('DNI')
    setNewDocNumber('')
    setNewName('')
    setLookupHint('')
    setLookingUp(false)
  }

  const isNewCustomer = customerId === 'new'

  const handleLookup = async () => {
    const document = newDocNumber.trim()
    if (document.length < 6) {
      setError(t('sales.ingresa-un-documento-valido'))
      return
    }
    setLookingUp(true)
    setLookupHint('')
    try {
      const result = await lookupDocument(document)
      if (result.found && result.name) {
        setNewName(result.name)
        setNewDocType(result.document_type)
        setLookupHint(
          result.source === 'local'
            ? t('sales.cliente-existente-se-reusara')
            : t('sales.datos-completados-desde-la-api'),
        )
      } else {
        setLookupHint(t('sales.documento-no-encontrado-completa-a-mano'))
      }
    } catch {
      setLookupHint(t('sales.consulta-no-disponible-completa-a-mano'))
    } finally {
      setLookingUp(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const addItem = () => {
    const product = products.find((entry) => entry.id === Number(productId))
    if (!product) return
    const quantityText = quantity.trim()
    const quantityNumber = Number(quantityText)
    if (quantityText !== '' && (!Number.isInteger(quantityNumber) || quantityNumber > 999999)) {
      setError(integer(1, 999999)(quantity))
      return
    }
    const parsedQuantity = Math.max(quantityNumber || 1, 1)
    const discountError = maxDecimals(2)(discount)
    if (discountError) {
      setError(discountError)
      return
    }
    const parsedDiscount = Math.max(Number(discount) || 0, 0)
    if (parsedDiscount > 100000000) {
      setError(numberRange(0, 100000000)(discount))
      return
    }
    setItems((previous) => {
      const existing = previous.find((item) => item.product_id === product.id)
      if (existing) {
        const nextQuantity = existing.quantity + parsedQuantity
        if (nextQuantity > product.stock) {
          setError(
            `${t('sales.stock-insuficiente-de')} ${product.name} (${t('sales.disponible')}: ${product.stock}).`,
          )
          return previous
        }
        return previous.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: nextQuantity, discount: item.discount + parsedDiscount }
            : item,
        )
      }
      if (parsedQuantity > product.stock) {
        setError(
          `${t('sales.stock-insuficiente-de')} ${product.name} (${t('sales.disponible')}: ${product.stock}).`,
        )
        return previous
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
      setError(t('sales.selecciona-un-cliente-2'))
      return
    }
    let inlineCustomer: SaleInput['customer'] | undefined
    if (isNewCustomer) {
      const document = newDocNumber.trim()
      if (document.length < 6) {
        setError(t('sales.ingresa-un-documento-valido'))
        return
      }
      if (newName.trim().length < 3) {
        setError(t('sales.ingresa-el-nombre-del-cliente'))
        return
      }
      inlineCustomer = {
        document_type: newDocType,
        document_number: document,
        name: newName.trim(),
      }
    }
    if (items.length === 0) {
      setError(t('sales.agrega-al-menos-un-producto-a-la-venta'))
      return
    }
    const paymentError =
      minNumber(0, t('sales.ingresa-un-monto-de-pago-valido'))(amount) ??
      maxDecimals(2)(amount) ??
      numberRange(0, 100000000)(amount)
    if (paymentError) {
      setError(paymentError)
      return
    }
    const payment = amount.trim() === '' ? totals.total : Number(amount)
    if (Number.isNaN(payment) || payment < 0) {
      setError(t('sales.ingresa-un-monto-de-pago-valido'))
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        ...(inlineCustomer ? { customer: inlineCustomer } : { customer_id: Number(customerId) }),
        seller_id: Number(effectiveSellerId),
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
      title={t('sales.registrar-venta')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            {t('sales.cancelar')}
          </Button>
          <Button type="submit" form="sale-form" loading={submitting}>
            {t('sales.registrar-venta')}
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente y vendedor */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('sales.cliente')}
            required
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value)
              setLookupHint('')
              setError(null)
            }}
            hint={customers.length === 0 ? t('sales.crea-clientes-en-el-menu-clientes') : undefined}
          >
            <option value="">{t('sales.selecciona-un-cliente')}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
            <option value="new">{t('sales.nuevo-cliente')}</option>
          </Select>
          <Select
            label={t('sales.vendedor')}
            value={effectiveSellerId}
            onChange={(event) => setSellerId(event.target.value)}
            hint={sellers.length === 0 ? t('sales.crea-vendedores-en-el-menu-vendedores') : undefined}
          >
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Alta rápida de cliente (se guarda en el listado al registrar la venta) */}
        {isNewCustomer && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="mb-3 text-body-sm font-semibold text-gray-700">
              {t('sales.nuevo-cliente-rapido')}
            </p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Select
                  aria-label={t('sales.tipo-de-documento')}
                  value={newDocType}
                  onChange={(event) => setNewDocType(event.target.value)}
                >
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">CE</option>
                </Select>
              </div>
              <div className="sm:col-span-4">
                <Input
                  aria-label={t('sales.documento')}
                  inputMode="numeric"
                  placeholder={newDocType === 'RUC' ? '20123456789' : '12345678'}
                  value={newDocNumber}
                  onChange={(event) => setNewDocNumber(event.target.value)}
                />
              </div>
              <div className="sm:col-span-5">
                <Input
                  aria-label={t('sales.nombre-del-cliente')}
                  placeholder={t('sales.nombre-del-cliente')}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleLookup} loading={lookingUp}>
                {t('sales.buscar-documento')}
              </Button>
              {lookupHint && <p className="text-caption text-gray-500">{lookupHint}</p>}
            </div>
          </div>
        )}

        {/* Agregar producto */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-body-sm font-semibold text-gray-700">
            {t('sales.agregar-producto')}
          </p>
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Select
                aria-label={t('sales.producto')}
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                hint={products.length === 0 ? t('sales.crea-productos-en-el-menu-productos') : undefined}
              >
                <option value="">{t('sales.producto-2')}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku}) · {t('sales.stock')} {product.stock}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label={t('sales.cantidad')}
                type="number"
                min="1"
                max="999999"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label={t('sales.descuento')}
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button variant="secondary" onClick={addItem} className="w-full">
                {t('sales.agregar')}
              </Button>
            </div>
          </div>
        </div>

        {/* Detalle del carrito */}
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
            {t('sales.aun-no-agregaste-productos-a-la-venta')}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {items.map((item) => {
              const product = products.find((entry) => entry.id === item.product_id)
              return (
                <li key={item.product_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-gray-900">{product?.name}</p>
                    <p className="text-caption text-gray-500">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                      {item.discount > 0 && ` · ${t('sales.desc')} ${formatCurrency(item.discount)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price - item.discount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product_id)}
                      aria-label={`${t('sales.quitar')} ${product?.name}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      {t('sales.quitar')}
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
              <span className="text-gray-600">{t('sales.subtotal')}</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">{t('sales.descuento')}</span>
              <span className="font-medium text-error">− {formatCurrency(totals.discount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">{t('sales.impuesto-18')}</span>
              <span className="font-medium">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">{t('sales.total')}</span>
              <span className="text-h4 font-bold text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <Select
              label={t('sales.metodo-de-pago')}
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
            <Input
              label={t('sales.monto-pagado-s')}
              type="number"
              min="0"
              max="100000000"
              step="0.01"
              inputMode="decimal"
              placeholder={totals.total > 0 ? String(totals.total) : '0.00'}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              hint={t('sales.vacio-pago-total')}
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
