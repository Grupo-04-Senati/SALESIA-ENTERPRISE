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
import { useDataVersion } from '@/data/DataProvider'
import { getState } from '@/data/store'
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '@/utils/formatters'
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
  draft: { label: 'Borrador', variant: 'neutral' },
  sent: { label: 'Enviada', variant: 'info' },
  approved: { label: 'Aprobada', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'error' },
  expired: { label: 'Vencida', variant: 'warning' },
  converted: { label: 'Convertida', variant: 'primary' },
}

const EDITABLE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'approved', 'rejected', 'expired']

const round2 = (value: number): number => Math.round(value * 100) / 100

export default function QuotesPage() {
  const toast = useToast()
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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las cotizaciones')
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
    { id: 'todas', label: `Todas (${counts.todas})` },
    { id: 'pendientes', label: `Pendientes (${counts.pendientes})` },
    { id: 'aprobadas', label: `Aprobadas (${counts.aprobadas})` },
    { id: 'convertidas', label: `Convertidas (${counts.convertidas})` },
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
    allProducts.find((product) => product.id === productId)?.name ?? `Producto #${productId}`

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
        'No se pudo cargar la cotización',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    }
  }

  const addLine = () => {
    const product = products.find((entry) => entry.id === Number(lineProductId))
    if (!product) {
      setFormError('Selecciona un producto para agregar la línea.')
      return
    }
    if (lines.some((line) => line.product_id === product.id)) {
      setFormError('Ese producto ya está en la cotización.')
      return
    }
    const quantity = Math.max(Number(lineQuantity) || 0, 1)
    const unitPrice = Number(linePrice)
    const discount = Number(lineDiscount) || 0
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      setFormError('Ingresa un precio unitario válido.')
      return
    }
    if (discount < 0) {
      setFormError('El descuento no puede ser negativo.')
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
      setFormError('Selecciona un cliente.')
      return
    }
    if (lines.length === 0) {
      setFormError('Agrega al menos un producto a la cotización.')
      return
    }
    const rate = Number(taxRate)
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      setFormError('La tasa de impuesto debe estar entre 0 y 1 (ej. 0.18).')
      return
    }
    setFormError(null)
    setSaving(true)
    const input = {
      customer_id: Number(customerId),
      valid_until: validUntil || null,
      notes: notes.trim() || null,
      tax_rate: rate,
      items: lines.map((line) => ({ ...line })),
    }
    try {
      if (editing) {
        await updateQuote(editing.id, input)
        toast.success('Cotización actualizada', `${editing.quote_number} se guardó correctamente.`)
      } else {
        const created = await createQuote(input)
        toast.success(
          'Cotización creada',
          `${created.quote_number} por ${formatCurrency(created.total)}.`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar la cotización.')
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
          reason instanceof Error ? reason.message : 'No se pudo cargar el detalle.',
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
        'Estado actualizado',
        `${statusQuote.quote_number} pasó a «${QUOTE_STATUS[nextStatus].label}».`,
      )
      setStatusQuote(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo cambiar el estado',
        reason instanceof Error ? reason.message : 'Error inesperado',
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
        'Cotización convertida',
        `${converted.quote_number} se convirtió en la venta ${converted.sale_number}.`,
      )
      reload()
    } catch (reason: unknown) {
      toast.error(
        'No se pudo convertir la cotización',
        reason instanceof Error ? reason.message : 'Error inesperado',
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
      toast.success('Cotización eliminada', `${deleting.quote_number} se eliminó del listado.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'No se pudo eliminar la cotización.',
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
          aria-label="Buscar cotizaciones"
          placeholder="Buscar por número de cotización o cliente…"
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
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && quotes.length === 0 ? (
        <div className="card">
          <DataTable headers={['Cotización', 'Cliente', 'Vigencia', 'Total', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando cotizaciones…
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="Sin cotizaciones"
            description="No hay cotizaciones que coincidan con el filtro. Crea la primera para preparar una propuesta para un cliente."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nueva cotización
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={['Cotización', 'Cliente', 'Vigencia', 'Total', 'Estado', 'Acciones']}>
            {visible.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell>
                  <div className="font-mono text-caption">{quote.quote_number}</div>
                  <div className="text-caption text-gray-500">{quote.item_count} ítems</div>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{quote.customer_name}</TableCell>
                <TableCell>{quote.valid_until ? formatDate(quote.valid_until) : '—'}</TableCell>
                <TableCell className="font-medium">{formatCurrency(quote.total)}</TableCell>
                <TableCell>
                  <Badge variant={QUOTE_STATUS[quote.status].variant}>
                    {QUOTE_STATUS[quote.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <RowButton label={`Ver ${quote.quote_number}`} onClick={() => openDetail(quote)}>
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </RowButton>
                    {(quote.status === 'draft' || quote.status === 'sent') && (
                      <RowButton label={`Editar ${quote.quote_number}`} onClick={() => openEdit(quote)}>
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </RowButton>
                    )}
                    {quote.status !== 'converted' && (
                      <RowButton
                        label={`Cambiar estado de ${quote.quote_number}`}
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
                        Convertir en venta
                      </Button>
                    )}
                    {quote.status === 'draft' && (
                      <RowButton
                        label={`Eliminar ${quote.quote_number}`}
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
          <h1>Cotizaciones</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Propuestas para clientes: estados, vigencia y conversión en venta.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva cotización
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
        title={editing ? `Editar ${editing.quote_number}` : 'Nueva cotización'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="quote-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear cotización'}
            </Button>
          </>
        }
      >
        <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Cliente"
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              hint={customers.length === 0 ? 'Crea clientes en el menú Clientes.' : undefined}
            >
              <option value="">Selecciona un cliente…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
            <Input
              label="Vigencia"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              hint="Fecha límite de validez."
            />
            <Input
              label="Tasa de impuesto"
              type="number"
              min="0"
              max="1"
              step="0.01"
              inputMode="decimal"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              hint="Entre 0 y 1 (0.18 = 18%)."
            />
          </div>
          <Textarea
            label="Notas"
            hint="Opcional. Condiciones de la propuesta."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej. Precios válidos por 15 días"
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-body-sm font-semibold text-gray-700">Agregar producto</p>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Select
                  aria-label="Producto"
                  value={lineProductId}
                  onChange={(event) => {
                    const value = event.target.value
                    setLineProductId(value)
                    const product = allProducts.find((entry) => entry.id === Number(value))
                    if (product) setLinePrice(String(product.sale_price))
                  }}
                  hint={products.length === 0 ? 'Crea productos en el menú Productos.' : undefined}
                >
                  <option value="">Producto…</option>
                  {products.map((product) => (
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
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label="Precio"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={linePrice}
                  onChange={(event) => setLinePrice(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label="Descuento"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={lineDiscount}
                  onChange={(event) => setLineDiscount(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={addLine}>
                Agregar línea
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
              Aún no agregaste productos a la cotización.
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
                      {line.discount > 0 && ` · desc. ${formatCurrency(line.discount)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-gray-900">
                      {formatCurrency(line.quantity * line.unit_price - line.discount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product_id)}
                      aria-label={`Quitar ${productName(line.product_id)}`}
                      className="text-caption text-gray-400 transition-colors hover:text-error"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">
                Impuesto ({formatPercent(Number(taxRate) || 0, 1)})
              </span>
              <span className="font-medium">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Total</span>
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
        title={detail ? `Cotización ${detail.quote_number}` : 'Detalle de la cotización'}
        size="lg"
      >
        {detailLoading ? (
          <p className="inline-flex items-center gap-2 py-6 text-body-sm text-gray-500">
            <Spinner size={16} className="text-loading" />
            Cargando detalle…
          </p>
        ) : detailError ? (
          <ErrorState description={detailError} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-body-sm sm:grid-cols-2">
              <div>
                <p className="text-caption text-gray-500">Cliente</p>
                <p className="font-medium text-gray-900">{detail.customer_name}</p>
              </div>
              <div>
                <p className="text-caption text-gray-500">Estado</p>
                <Badge variant={QUOTE_STATUS[detail.status].variant}>
                  {QUOTE_STATUS[detail.status].label}
                </Badge>
              </div>
              <div>
                <p className="text-caption text-gray-500">Vigencia</p>
                <p className="font-medium text-gray-900">
                  {detail.valid_until ? formatDate(detail.valid_until) : '—'}
                </p>
              </div>
              <div>
                <p className="text-caption text-gray-500">Creada</p>
                <p className="font-medium text-gray-900">{formatDateTime(detail.created_at)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-caption text-gray-500">Notas</p>
                <p className="font-medium text-gray-900">{detail.notes || '—'}</p>
              </div>
            </div>

            <DataTable headers={['Producto', 'Cantidad', 'Precio', 'Descuento', 'Subtotal']}>
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
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Impuesto</span>
                <span className="font-medium">{formatCurrency(detail.tax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Total</span>
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
        title={statusQuote ? `Estado de ${statusQuote.quote_number}` : 'Cambiar estado'}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusQuote(null)} disabled={statusBusy}>
              Cancelar
            </Button>
            <Button onClick={handleStatus} loading={statusBusy}>
              Guardar estado
            </Button>
          </>
        }
      >
        {statusQuote && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado actual</span>
                <Badge variant={QUOTE_STATUS[statusQuote.status].variant}>
                  {QUOTE_STATUS[statusQuote.status].label}
                </Badge>
              </div>
            </div>
            <Select
              label="Nuevo estado"
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as QuoteStatus)}
              hint="Solo se muestran los estados que permite el backend."
            >
              {EDITABLE_STATUSES.filter((status) => status !== statusQuote.status).map((status) => (
                <option key={status} value={status}>
                  {QUOTE_STATUS[status].label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar cotización"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar la cotización <strong>{deleting?.quote_number}</strong>? Solo se pueden
          eliminar las cotizaciones en borrador.
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
