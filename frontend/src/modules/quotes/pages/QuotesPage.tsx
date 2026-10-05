import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Eye, FileText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { useDataVersion } from '@/data/DataProvider'
import { getState } from '@/data/store'
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '@/utils/formatters'
import {
  cleanText,
  integer,
  maxDecimals,
  maxLength,
  minNumber,
  notPastDate,
  numberRange,
} from '@/utils/validators'
import {
  convertQuote,
  createQuote,
  deleteQuote,
  getQuote,
  listQuotes,
  setQuoteStatus,
  updateQuote,
} from '../services/quoteService'
import type { Quote, QuoteLine, QuoteStatus } from '../services/quoteService'

/**
 * Página de Cotizaciones (FE-1): barra de pestañas con conteo, CRUD con
 * líneas dinámicas y totales en vivo, cambio de estado y conversión a venta.
 */

const QUOTE_STATUS: Record<QuoteStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'quotes.estado-borrador', variant: 'neutral' },
  sent: { label: 'quotes.estado-enviada', variant: 'info' },
  approved: { label: 'quotes.estado-aprobada', variant: 'success' },
  rejected: { label: 'quotes.estado-rechazada', variant: 'error' },
  expired: { label: 'quotes.estado-vencida', variant: 'warning' },
  converted: { label: 'quotes.estado-convertida', variant: 'primary' },
}

const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'approved', 'rejected', 'expired']

const round2 = (value: number): number => Math.round(value * 100) / 100

export default function QuotesPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()
  const allCustomers = useMemo(() => getState().customers, [version])
  const allProducts = useMemo(() => getState().products, [version])
  const customers = useMemo(
    () => allCustomers.filter((customer) => customer.status === 'active'),
    [allCustomers],
  )
  const products = useMemo(
    () => allProducts.filter((product) => product.status === 'active'),
    [allProducts],
  )

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('todas')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [taxRate, setTaxRate] = useState('0.18')
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [linePrice, setLinePrice] = useState('0')
  const [lineDiscount, setLineDiscount] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Quote | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [statusQuote, setStatusQuote] = useState<Quote | null>(null)
  const [nextStatus, setNextStatus] = useState<QuoteStatus>('sent')
  const [statusBusy, setStatusBusy] = useState(false)

  const [convertingId, setConvertingId] = useState<number | null>(null)

  const [deleting, setDeleting] = useState<Quote | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listQuotes()
      .then((result) => {
        if (!cancelled) setQuotes(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('quotes.no-se-pudieron-cargar-las-cotizaciones'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt, version])

  const counts = useMemo(
    () => ({
      todas: quotes.length,
      pendientes: quotes.filter(
        (quote) => quote.status === 'draft' || quote.status === 'sent',
      ).length,
      aprobadas: quotes.filter((quote) => quote.status === 'approved').length,
      convertidas: quotes.filter((quote) => quote.status === 'converted').length,
    }),
    [quotes],
  )

  const tabItems = [
    { id: 'todas', label: t('quotes.todas', { n: counts.todas }) },
    { id: 'pendientes', label: t('quotes.pendientes', { n: counts.pendientes }) },
    { id: 'aprobadas', label: t('quotes.aprobadas', { n: counts.aprobadas }) },
    { id: 'convertidas', label: t('quotes.convertidas', { n: counts.convertidas }) },
  ]

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return quotes.filter((quote) => {
      const matchesTab =
        tab === 'todas' ||
        (tab === 'pendientes' && (quote.status === 'draft' || quote.status === 'sent')) ||
        (tab === 'aprobadas' && quote.status === 'approved') ||
        (tab === 'convertidas' && quote.status === 'converted')
      const matchesSearch =
        term === '' ||
        quote.quote_number.toLowerCase().includes(term) ||
        quote.customer_name.toLowerCase().includes(term)
      return matchesTab && matchesSearch
    })
  }, [quotes, search, tab])

  const totals = useMemo(() => {
    const subtotal = round2(
      lines.reduce((total, line) => total + line.quantity * line.unit_price - line.discount, 0),
    )
    const rate = Number(taxRate) || 0
    const tax = round2(subtotal * rate)
    return { subtotal, tax, total: round2(subtotal + tax) }
  }, [lines, taxRate])

  const reload = () => setAttempt((value) => value + 1)

  const productName = (productId: number): string =>
    allProducts.find((product) => product.id === productId)?.name ??
    `${t('quotes.producto-num')}${productId}`

  const resetForm = () => {
    setCustomerId('')
    setValidUntil('')
    setNotes('')
    setTaxRate('0.18')
    setLines([])
    setLineProductId('')
    setLineQuantity('1')
    setLinePrice('0')
    setLineDiscount('0')
    setFormError(null)
  }

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setFormOpen(true)
  }

  const openEdit = async (quote: Quote) => {
    setFormError(null)
    try {
      const full = await getQuote(quote.id)
      setEditing(full)
      setCustomerId(String(full.customer_id))
      setValidUntil(full.valid_until ? full.valid_until.slice(0, 10) : '')
      setNotes(full.notes ?? '')
      setTaxRate(
        String(
          full.tax_rate ??
            (full.subtotal > 0 ? full.tax / full.subtotal : 0.18),
        ),
      )
      setLines(
        (full.items ?? []).map(({ product_id, quantity, unit_price, discount }) => ({
          product_id,
          quantity,
          unit_price,
          discount,
        })),
      )
      setLineProductId('')
      setLineQuantity('1')
      setLinePrice('0')
      setLineDiscount('0')
      setFormOpen(true)
    } catch (reason: unknown) {
      toast.error(
        t('quotes.no-se-pudo-cargar-la-cotizacion'),
        reason instanceof Error ? reason.message : t('quotes.error-inesperado'),
      )
    }
  }

  const addLine = () => {
    const product = products.find((entry) => entry.id === Number(lineProductId))
    if (!product) {
      setFormError(t('quotes.selecciona-un-producto-para-agregar-la-linea'))
      return
    }
    if (lines.some((line) => line.product_id === product.id)) {
      setFormError(t('quotes.ese-producto-ya-esta-en-la-cotizacion'))
      return
    }
    const quantityText = lineQuantity.trim()
    const quantityNumber = Number(quantityText)
    if (quantityText !== '' && (!Number.isInteger(quantityNumber) || quantityNumber > 999999)) {
      setFormError(integer(1, 999999)(lineQuantity))
      return
    }
    const quantity = Math.max(Number(lineQuantity) || 0, 1)
    const priceError =
      minNumber(0, t('quotes.ingresa-un-precio-unitario-valido'))(linePrice) ??
      maxDecimals(2)(linePrice) ??
      numberRange(0, 100000000)(linePrice)
    if (priceError) {
      setFormError(priceError)
      return
    }
    const unitPrice = Number(linePrice)
    const discountError =
      minNumber(0, t('quotes.el-descuento-no-puede-ser-negativo'))(lineDiscount) ??
      maxDecimals(2)(lineDiscount) ??
      numberRange(0, 100000000)(lineDiscount)
    if (discountError) {
      setFormError(discountError)
      return
    }
    const discount = Number(lineDiscount) || 0
    if (discount > round2(quantity * unitPrice)) {
      setFormError('El descuento de la línea supera su subtotal (RN-13).')
      return
    }
    setLines((previous) => [
      ...previous,
      { product_id: product.id, quantity, unit_price: unitPrice, discount },
    ])
    setLineProductId('')
    setLineQuantity('1')
    setLinePrice('0')
    setLineDiscount('0')
    setFormError(null)
  }

  const removeLine = (productId: number) => {
    setLines((previous) => previous.filter((line) => line.product_id !== productId))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerId) {
      setFormError(t('quotes.selecciona-un-cliente'))
      return
    }
    if (lines.length === 0) {
      setFormError(t('quotes.agrega-al-menos-un-producto-a-la-cotizacion'))
      return
    }
    const rate = Number(taxRate)
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      setFormError(t('quotes.la-tasa-de-impuesto-debe-estar-entre-0-y-1'))
      return
    }
    const untilError = notPastDate()(validUntil)
    if (untilError) {
      setFormError(untilError)
      return
    }
    const notesError = maxLength(500)(notes)
    if (notesError) {
      setFormError(notesError)
      return
    }
    setFormError(null)
    setSaving(true)
    const input = {
      customer_id: Number(customerId),
      valid_until: validUntil || null,
      notes: cleanText(notes) || null,
      tax_rate: rate,
      items: lines.map((line) => ({ ...line })),
    }
    try {
      if (editing) {
        await updateQuote(editing.id, input)
        toast.success(
          t('quotes.cotizacion-actualizada'),
          `${editing.quote_number} ${t('quotes.se-guardo-correctamente')}`,
        )
      } else {
        const created = await createQuote(input)
        toast.success(
          t('quotes.cotizacion-creada'),
          `${created.quote_number} ${t('quotes.por')} ${formatCurrency(created.total)}.`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('quotes.no-se-pudo-guardar-la-cotizacion'),
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetail = (quote: Quote) => {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setDetailId(quote.id)
    getQuote(quote.id)
      .then((full) => setDetail(full))
      .catch((reason: unknown) =>
        setDetailError(
          reason instanceof Error ? reason.message : t('quotes.no-se-pudo-cargar-el-detalle'),
        ),
      )
      .finally(() => setDetailLoading(false))
  }

  const closeDetail = () => {
    setDetailId(null)
    setDetail(null)
    setDetailError(null)
  }

  const openStatus = (quote: Quote) => {
    const available = EDITABLE_STATUSES.filter((status) => status !== quote.status)
    setStatusQuote(quote)
    setNextStatus(available[0] ?? quote.status)
  }

  const handleStatus = async () => {
    if (!statusQuote) return
    setStatusBusy(true)
    try {
      await setQuoteStatus(statusQuote.id, nextStatus)
      toast.success(
        t('quotes.estado-actualizado'),
        `${statusQuote.quote_number} ${t('quotes.paso-a')} «${t(QUOTE_STATUS[nextStatus].label)}».`,
      )
      setStatusQuote(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('quotes.no-se-pudo-cambiar-el-estado'),
        reason instanceof Error ? reason.message : t('quotes.error-inesperado'),
      )
    } finally {
      setStatusBusy(false)
    }
  }

  const handleConvert = async (quote: Quote) => {
    setConvertingId(quote.id)
    try {
      const converted = await convertQuote(quote.id)
      toast.success(
        t('quotes.cotizacion-convertida'),
        `${converted.quote_number} ${t('quotes.se-convirtio-en-la-venta')} ${converted.sale_number}.`,
      )
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('quotes.no-se-pudo-convertir-la-cotizacion'),
        reason instanceof Error ? reason.message : t('quotes.error-inesperado'),
      )
    } finally {
      setConvertingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    setDeleteError(null)
    try {
      await deleteQuote(deleting.id)
      toast.success(
        t('quotes.cotizacion-eliminada'),
        `${deleting.quote_number} ${t('quotes.se-elimino-del-listado')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : t('quotes.no-se-pudo-eliminar-la-cotizacion'),
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  const content = (
    <>
      <div className="card">
        <Input
          type="search"
          aria-label={t('quotes.buscar-cotizaciones')}
          placeholder={t('quotes.buscar-por-numero-de-cotizacion-o-cliente')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('quotes.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && quotes.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('quotes.cotizacion'),
              t('quotes.cliente'),
              t('quotes.vigencia'),
              t('quotes.total'),
              t('quotes.estado'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('quotes.cargando-cotizaciones')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title={t('quotes.sin-cotizaciones')}
            description={t('quotes.no-hay-cotizaciones-que-coincidan-con-el-filtro')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('quotes.nueva-cotizacion')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('quotes.cotizacion'),
              t('quotes.cliente'),
              t('quotes.vigencia'),
              t('quotes.total'),
              t('quotes.estado'),
              t('quotes.acciones'),
            ]}
          >
            {visible.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell>
                  <div className="font-mono text-caption">{quote.quote_number}</div>
                  <div className="text-caption text-gray-500">
                    {t('quotes.items', { n: quote.item_count })}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{quote.customer_name}</TableCell>
                <TableCell>{quote.valid_until ? formatDate(quote.valid_until) : '—'}</TableCell>
                <TableCell className="font-medium">{formatCurrency(quote.total)}</TableCell>
                <TableCell>
                  <Badge variant={QUOTE_STATUS[quote.status].variant}>
                    {t(QUOTE_STATUS[quote.status].label)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton
                      label={`${t('quotes.ver')} ${quote.quote_number}`}
                      onClick={() => openDetail(quote)}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    {(quote.status === 'draft' || quote.status === 'sent') && (
                      <RowButton
                        label={`${t('quotes.editar')} ${quote.quote_number}`}
                        onClick={() => openEdit(quote)}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </RowButton>
                    )}
                    {quote.status !== 'converted' && (
                      <RowButton
                        label={`${t('quotes.cambiar-estado-de')} ${quote.quote_number}`}
                        onClick={() => openStatus(quote)}
                      >
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />
                      </RowButton>
                    )}
                    {quote.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => handleConvert(quote)}
                        loading={convertingId === quote.id}
                      >
                        {t('quotes.convertir-en-venta')}
                      </Button>
                    )}
                    {quote.status === 'draft' && (
                      <RowButton
                        label={`${t('quotes.eliminar')} ${quote.quote_number}`}
                        tone="danger"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleting(quote)
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </RowButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('quotes.cotizaciones')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            {t('quotes.propuestas-para-clientes-estados-vigencia-y-conversion-en-venta')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('quotes.nueva-cotizacion')}
        </Button>
      </div>

      <Tabs items={tabItems} value={tab} onChange={setTab} id="cotizaciones" />

      <TabPanel tabId="todas" active={tab === 'todas'}>
        {content}
      </TabPanel>
      <TabPanel tabId="pendientes" active={tab === 'pendientes'}>
        {content}
      </TabPanel>
      <TabPanel tabId="aprobadas" active={tab === 'aprobadas'}>
        {content}
      </TabPanel>
      <TabPanel tabId="convertidas" active={tab === 'convertidas'}>
        {content}
      </TabPanel>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false)
        }}
        title={
          editing ? `${t('quotes.editar')} ${editing.quote_number}` : t('quotes.nueva-cotizacion')
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('quotes.cancelar')}
            </Button>
            <Button type="submit" form="quote-form" loading={saving}>
              {editing ? t('quotes.guardar-cambios') : t('quotes.crear-cotizacion')}
            </Button>
          </>
        }
      >
        <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label={t('quotes.cliente')}
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              hint={
                customers.length === 0 ? t('quotes.crea-clientes-en-el-menu-clientes') : undefined
              }
            >
              <option value="">{t('quotes.selecciona-un-cliente-2')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            <Input
              label={t('quotes.vigencia')}
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              hint={t('quotes.fecha-limite-de-validez')}
            />
            <Input
              label={t('quotes.tasa-de-impuesto')}
              type="number"
              min="0"
              max="1"
              step="0.01"
              inputMode="decimal"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              hint={t('quotes.entre-0-y-1-0-18-18')}
            />
          </div>
          <Textarea
            label={t('quotes.notas')}
            maxLength={500}
            hint={t('quotes.opcional-condiciones-de-la-propuesta')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('quotes.ej-precios-validos-por-15-dias')}
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-body-sm font-semibold text-gray-700">
              {t('quotes.agregar-producto')}
            </p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Select
                  aria-label={t('quotes.producto')}
                  value={lineProductId}
                  onChange={(event) => {
                    const value = event.target.value
                    setLineProductId(value)
                    const product = allProducts.find((entry) => entry.id === Number(value))
                    if (product) setLinePrice(String(product.sale_price))
                  }}
                  hint={
                    products.length === 0 ? t('quotes.crea-productos-en-el-menu-productos') : undefined
                  }
                >
                  <option value="">{t('quotes.producto-2')}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label={t('quotes.cantidad')}
                  type="number"
                  min="1"
                  max="999999"
                  step="1"
                  inputMode="numeric"
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label={t('quotes.precio')}
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  inputMode="decimal"
                  value={linePrice}
                  onChange={(event) => setLinePrice(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label={t('quotes.descuento')}
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  inputMode="decimal"
                  value={lineDiscount}
                  onChange={(event) => setLineDiscount(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={addLine}>
                {t('quotes.agregar-linea')}
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
              {t('quotes.aun-no-agregaste-productos-a-la-cotizacion')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {lines.map((line) => (
                <li
                  key={line.product_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-gray-900">
                      {productName(line.product_id)}
                    </p>
                    <p className="text-caption text-gray-500">
                      {line.quantity} × {formatCurrency(line.unit_price)}
                      {line.discount > 0 &&
                        ` · ${t('quotes.desc')} ${formatCurrency(line.discount)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-gray-900">
                      {formatCurrency(line.quantity * line.unit_price - line.discount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product_id)}
                      aria-label={`${t('quotes.quitar')} ${productName(line.product_id)}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      {t('quotes.quitar')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">{t('quotes.subtotal')}</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">
                {t('quotes.impuesto')} ({formatPercent(Number(taxRate) || 0, 1)})
              </span>
              <span className="font-medium">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">{t('quotes.total')}</span>
              <span className="text-h4 font-bold text-primary">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-md border border-error bg-error-bg px-3 py-2 text-caption text-error-fg">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={detailId !== null}
        onClose={closeDetail}
        title={
          detail
            ? `${t('quotes.cotizacion')} ${detail.quote_number}`
            : t('quotes.detalle-de-la-cotizacion')
        }
        size="lg"
      >
        {detailLoading ? (
          <p className="inline-flex items-center gap-2 py-6 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            {t('quotes.cargando-detalle')}
          </p>
        ) : detailError ? (
          <ErrorState description={detailError} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div>
                <p className="text-caption text-gray-500">{t('quotes.cliente')}</p>
                <p className="font-medium text-gray-900">{detail.customer_name}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('quotes.estado')}</p>
                <Badge variant={QUOTE_STATUS[detail.status].variant}>
                  {t(QUOTE_STATUS[detail.status].label)}
                </Badge>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('quotes.vigencia')}</p>
                <p className="font-medium text-gray-900">
                  {detail.valid_until ? formatDate(detail.valid_until) : '—'}
                </p>
              </div>
              <div>
                <p className="text-caption text-gray-500">{t('quotes.creada')}</p>
                <p className="font-medium text-gray-900">{formatDateTime(detail.created_at)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-caption text-gray-500">{t('quotes.notas')}</p>
                <p className="font-medium text-gray-900">{detail.notes || '—'}</p>
              </div>
            </div>

            <DataTable
              headers={[
                t('quotes.producto'),
                t('quotes.cantidad'),
                t('quotes.precio'),
                t('quotes.descuento'),
                t('quotes.subtotal'),
              ]}
            >
              {(detail.items ?? []).map((item) => (
                <TableRow key={item.id ?? item.product_id}>
                  <TableCell className="font-medium text-gray-900">
                    {item.product_name ?? productName(item.product_id)}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell>{item.discount > 0 ? `− ${formatCurrency(item.discount)}` : '—'}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(
                      item.subtotal ?? item.quantity * item.unit_price - item.discount,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>

            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex justify-between py-1">
                <span className="text-gray-600">{t('quotes.subtotal')}</span>
                <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-600">{t('quotes.impuesto')}</span>
                <span className="font-medium">{formatCurrency(detail.tax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">{t('quotes.total')}</span>
                <span className="text-h4 font-bold text-primary">
                  {formatCurrency(detail.total)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={statusQuote !== null}
        onClose={() => setStatusQuote(null)}
        title={
          statusQuote
            ? `${t('quotes.estado-de')} ${statusQuote.quote_number}`
            : t('quotes.cambiar-estado')
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusQuote(null)} disabled={statusBusy}>
              {t('quotes.cancelar')}
            </Button>
            <Button onClick={handleStatus} loading={statusBusy}>
              {t('quotes.guardar-estado')}
            </Button>
          </>
        }
      >
        {statusQuote && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('quotes.estado-actual')}</span>
                <Badge variant={QUOTE_STATUS[statusQuote.status].variant}>
                  {t(QUOTE_STATUS[statusQuote.status].label)}
                </Badge>
              </div>
            </div>
            <Select
              label={t('quotes.nuevo-estado')}
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as QuoteStatus)}
              hint={t('quotes.solo-se-muestran-los-estados-que-permite-el-backend')}
            >
              {EDITABLE_STATUSES.filter((status) => status !== statusQuote.status).map((status) => (
                <option key={status} value={status}>
                  {t(QUOTE_STATUS[status].label)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('quotes.eliminar-cotizacion')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              {t('quotes.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              {t('quotes.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('quotes.eliminar-la-cotizacion')} <strong>{deleting?.quote_number}</strong>
          {t('quotes.solo-se-pueden-eliminar-las-cotizaciones-en-borrador')}
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}

function RowButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors ${
        tone === 'danger'
          ? 'hover:bg-red-50 hover:text-error'
          : 'hover:bg-gray-100 hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}
