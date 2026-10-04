import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BadgePercent, Pencil, Percent, Plus, Tags, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Checkbox, Input, Select } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { useDataVersion } from '@/data/DataProvider'
import { getState } from '@/data/store'
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters'
import {
  createPriceList,
  createPromotion,
  deletePriceList,
  deletePromotion,
  getPriceList,
  getPromotion,
  listPriceLists,
  listPromotions,
  replacePriceListItems,
  updatePriceList,
  updatePromotion,
} from '../services/pricingService'
import type {
  PriceList,
  PriceListLineInput,
  Promotion,
  PromotionInput,
  PromotionKind,
} from '../services/pricingService'

/**
 * Precios (FE-2 · /precios).
 * Pestaña «Listas de precios»: catálogo de listas y editor de precios por
 * producto (PUT /price-lists/{id}/items). Pestaña «Promociones»: descuentos
 * por porcentaje o monto fijo con su ventana de vigencia y productos.
 */

const EMPTY_LIST_FORM = { name: '', currency: 'PEN' }

const EMPTY_PROMO_FORM = {
  name: '',
  kind: 'percent' as PromotionKind,
  value: '',
  starts_at: '',
  ends_at: '',
}

interface PriceDraft {
  product_id: string
  price: string
}

const EMPTY_PRICE: PriceDraft = { product_id: '', price: '' }

/** datetime-local (hora local) → "YYYY-MM-DDTHH:mm" para rellenar el input. */
const toLocalInput = (value: string | null | undefined): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** Una promoción está activa si no está desactivada y hoy cae en su vigencia. */
const isPromotionActive = (promotion: Promotion): boolean => {
  const status = promotion.status?.toLowerCase()
  if (status === 'inactive' || status === 'disabled') return false
  const now = Date.now()
  if (promotion.starts_at && new Date(promotion.starts_at).getTime() > now) return false
  if (promotion.ends_at && new Date(promotion.ends_at).getTime() < now) return false
  return true
}

const money = (value: number, currency: string): string =>
  currency === 'PEN' ? formatCurrency(value) : `${currency} ${value.toFixed(2)}`

export default function PricingPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()

  const TAB_ITEMS = [
    { id: 'listas', label: t('pricing.tab-listas') },
    { id: 'promociones', label: t('pricing.tab-promociones') },
  ]

  const KIND_LABELS: Record<PromotionKind, string> = {
    percent: t('pricing.kind-percent'),
    fixed: t('pricing.kind-fixed'),
  }

  const [tab, setTab] = useState('listas')

  const [lists, setLists] = useState<PriceList[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [listsError, setListsError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [listOpen, setListOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | null>(null)
  const [listForm, setListForm] = useState(EMPTY_LIST_FORM)
  const [listError, setListError] = useState<string | null>(null)
  const [savingList, setSavingList] = useState(false)
  const [deletingList, setDeletingList] = useState<PriceList | null>(null)
  const [deleteListError, setDeleteListError] = useState<string | null>(null)

  const [pricesOpen, setPricesOpen] = useState(false)
  const [pricesList, setPricesList] = useState<PriceList | null>(null)
  const [priceDraft, setPriceDraft] = useState<PriceDraft[]>([EMPTY_PRICE])
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState<string | null>(null)
  const [savingPrices, setSavingPrices] = useState(false)

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [promosLoading, setPromosLoading] = useState(true)
  const [promosError, setPromosError] = useState<string | null>(null)
  const [promoSearch, setPromoSearch] = useState('')

  const [promoOpen, setPromoOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO_FORM)
  const [promoProductIds, setPromoProductIds] = useState<number[]>([])
  const [promoError, setPromoError] = useState<string | null>(null)
  const [savingPromo, setSavingPromo] = useState(false)
  const [deletingPromo, setDeletingPromo] = useState<Promotion | null>(null)
  const [deletePromoError, setDeletePromoError] = useState<string | null>(null)

  const products = useMemo(() => getState().products, [version])

  useEffect(() => {
    let cancelled = false
    setListsLoading(true)
    setListsError(null)
    listPriceLists()
      .then((items) => {
        if (!cancelled) setLists(items)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setListsError(reason instanceof Error ? reason.message : t('pricing.err-load-lists'))
        }
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt, version])

  useEffect(() => {
    let cancelled = false
    setPromosLoading(true)
    setPromosError(null)
    listPromotions()
      .then((items) => {
        if (!cancelled) setPromotions(items)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setPromosError(
            reason instanceof Error ? reason.message : t('pricing.err-load-promos'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setPromosLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt, version])

  const visibleLists = useMemo(() => {
    const term = search.trim().toLowerCase()
    return lists.filter((list) => term === '' || list.name.toLowerCase().includes(term))
  }, [lists, search])

  const visiblePromos = useMemo(() => {
    const term = promoSearch.trim().toLowerCase()
    return promotions.filter((promo) => term === '' || promo.name.toLowerCase().includes(term))
  }, [promotions, promoSearch])

  const reload = () => setAttempt((value) => value + 1)

  /* ----------------------------------------------------------------
     Listas de precios
     ---------------------------------------------------------------- */

  const openListCreate = () => {
    setEditingList(null)
    setListForm(EMPTY_LIST_FORM)
    setListError(null)
    setListOpen(true)
  }

  const openListEdit = (list: PriceList) => {
    setEditingList(list)
    setListForm({ name: list.name, currency: list.currency })
    setListError(null)
    setListOpen(true)
  }

  const handleListSubmit = async () => {
    const name = listForm.name.trim()
    if (name.length < 2) {
      setListError(t('pricing.err-name-min'))
      return
    }
    setListError(null)
    setSavingList(true)
    try {
      if (editingList) {
        await updatePriceList(editingList.id, { name, currency: listForm.currency })
        toast.success(t('pricing.toast-list-updated'), `${name} ${t('pricing.toast-saved-body')}`)
      } else {
        await createPriceList({ name, currency: listForm.currency })
        toast.success(
          t('pricing.toast-list-created'),
          `${name} ${t('pricing.toast-list-created-body')}`,
        )
      }
      setListOpen(false)
      reload()
    } catch (reason: unknown) {
      setListError(reason instanceof Error ? reason.message : t('pricing.err-save-list'))
    } finally {
      setSavingList(false)
    }
  }

  const handleListDelete = async () => {
    if (!deletingList) return
    setDeleteListError(null)
    try {
      await deletePriceList(deletingList.id)
      toast.success(
        t('pricing.toast-list-deleted'),
        `${deletingList.name} ${t('pricing.toast-list-deleted-body')}`,
      )
      setDeletingList(null)
      reload()
    } catch (reason: unknown) {
      setDeleteListError(reason instanceof Error ? reason.message : t('pricing.err-delete-list'))
    }
  }

  const loadPrices = (list: PriceList) => {
    setPricesLoading(true)
    setPricesError(null)
    getPriceList(list.id)
      .then((full) => {
        const items = full.items ?? []
        setPriceDraft(
          items.length > 0
            ? items.map((item) => ({
                product_id: String(item.product_id),
                price: String(item.price),
              }))
            : [EMPTY_PRICE],
        )
      })
      .catch((reason: unknown) => {
        setPriceDraft([EMPTY_PRICE])
        setPricesError(
          reason instanceof Error ? reason.message : t('pricing.err-load-prices'),
        )
      })
      .finally(() => setPricesLoading(false))
  }

  const openPrices = (list: PriceList) => {
    setPricesList(list)
    setPriceDraft([EMPTY_PRICE])
    setPricesOpen(true)
    loadPrices(list)
  }

  const updatePriceDraft = (index: number, patch: Partial<PriceDraft>) => {
    setPriceDraft((previous) =>
      previous.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    )
  }

  const handlePricesSubmit = async () => {
    if (!pricesList) return
    const items: PriceListLineInput[] = []
    const seen = new Set<number>()
    for (const line of priceDraft) {
      if (!line.product_id) continue
      const price = Number(line.price)
      if (line.price.trim() === '' || Number.isNaN(price) || price < 0) {
        setPricesError(t('pricing.err-price-invalid'))
        return
      }
      const productId = Number(line.product_id)
      if (seen.has(productId)) {
        setPricesError(t('pricing.err-duplicate-product'))
        return
      }
      seen.add(productId)
      items.push({ product_id: productId, price })
    }
    if (items.length === 0) {
      setPricesError(t('pricing.err-prices-empty'))
      return
    }
    setPricesError(null)
    setSavingPrices(true)
    try {
      await replacePriceListItems(pricesList.id, items)
      toast.success(
        t('pricing.toast-prices-updated'),
        `${pricesList.name}: ${t('pricing.toast-prices-body', { n: items.length })}`,
      )
      setPricesOpen(false)
      reload()
    } catch (reason: unknown) {
      setPricesError(reason instanceof Error ? reason.message : t('pricing.err-save-prices'))
    } finally {
      setSavingPrices(false)
    }
  }

  /* ----------------------------------------------------------------
     Promociones
     ---------------------------------------------------------------- */

  const openPromoCreate = () => {
    setEditingPromo(null)
    setPromoForm(EMPTY_PROMO_FORM)
    setPromoProductIds([])
    setPromoError(null)
    setPromoOpen(true)
  }

  const openPromoEdit = async (promotion: Promotion) => {
    setEditingPromo(promotion)
    setPromoForm({
      name: promotion.name,
      kind: promotion.kind,
      value: String(promotion.value),
      starts_at: toLocalInput(promotion.starts_at),
      ends_at: toLocalInput(promotion.ends_at),
    })
    setPromoError(null)
    setPromoOpen(true)
    try {
      const full = await getPromotion(promotion.id)
      setPromoProductIds(full.product_ids ?? (full.items ?? []).map((item) => item.product_id))
    } catch {
      setPromoProductIds(promotion.product_ids ?? [])
    }
  }

  const togglePromoProduct = (productId: number) => {
    setPromoProductIds((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId],
    )
  }

  const handlePromoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = promoForm.name.trim()
    const value = Number(promoForm.value)
    if (name.length < 2) {
      setPromoError(t('pricing.err-name-min'))
      return
    }
    if (promoForm.value.trim() === '' || Number.isNaN(value) || value <= 0) {
      setPromoError(t('pricing.err-value-positive'))
      return
    }
    if (promoForm.kind === 'percent' && value > 100) {
      setPromoError(t('pricing.err-percent-max'))
      return
    }
    if (promoForm.starts_at && promoForm.ends_at) {
      if (new Date(promoForm.starts_at).getTime() >= new Date(promoForm.ends_at).getTime()) {
        setPromoError(t('pricing.err-dates-order'))
        return
      }
    }
    if (promoProductIds.length === 0) {
      setPromoError(t('pricing.err-promo-products'))
      return
    }
    setPromoError(null)
    setSavingPromo(true)
    try {
      const input: PromotionInput = {
        name,
        kind: promoForm.kind,
        value,
        starts_at: promoForm.starts_at ? new Date(promoForm.starts_at).toISOString() : null,
        ends_at: promoForm.ends_at ? new Date(promoForm.ends_at).toISOString() : null,
        product_ids: promoProductIds,
      }
      if (editingPromo) {
        await updatePromotion(editingPromo.id, input)
        toast.success(t('pricing.toast-promo-updated'), `${name} ${t('pricing.toast-saved-body')}`)
      } else {
        await createPromotion(input)
        toast.success(
          t('pricing.toast-promo-created'),
          `${name} ${t('pricing.toast-promo-created-body')}`,
        )
      }
      setPromoOpen(false)
      reload()
    } catch (reason: unknown) {
      setPromoError(
        reason instanceof Error ? reason.message : t('pricing.err-save-promo'),
      )
    } finally {
      setSavingPromo(false)
    }
  }

  const handlePromoDelete = async () => {
    if (!deletingPromo) return
    setDeletePromoError(null)
    try {
      await deletePromotion(deletingPromo.id)
      toast.success(
        t('pricing.toast-promo-deleted'),
        `${deletingPromo.name} ${t('pricing.toast-promo-deleted-body')}`,
      )
      setDeletingPromo(null)
      reload()
    } catch (reason: unknown) {
      setDeletePromoError(
        reason instanceof Error ? reason.message : t('pricing.err-delete-promo'),
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('pricing.title')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">{t('pricing.lead')}</p>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="precios" />

      {/* Listas de precios */}
      <TabPanel tabId="listas" active={tab === 'listas'}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm text-gray-600">
              {lists.length === 0
                ? t('pricing.lists-empty')
                : t('pricing.lists-count', { n: lists.length })}
            </p>
            <Button onClick={openListCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t('pricing.new-list')}
            </Button>
          </div>

          <div className="card">
            <Input
              type="search"
              aria-label={t('pricing.search-lists-label')}
              placeholder={t('pricing.search-lists-placeholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {listsError ? (
            <div className="card">
              <ErrorState
                description={listsError}
                action={
                  <Button variant="outline" onClick={reload}>
                    {t('pricing.retry')}
                  </Button>
                }
              />
            </div>
          ) : listsLoading && lists.length === 0 ? (
            <div className="card">
              <DataTable
                headers={[
                  t('pricing.list'),
                  t('pricing.currency'),
                  t('pricing.items'),
                  t('pricing.status'),
                  '',
                ]}
              >
                <TableStateRow colSpan={5}>
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} className="text-loading" />
                    {t('pricing.loading-lists')}
                  </span>
                </TableStateRow>
              </DataTable>
            </div>
          ) : visibleLists.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Tags}
                title={t('pricing.no-lists-title')}
                description={t('pricing.no-lists-desc')}
                action={
                  <Button onClick={openListCreate}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {t('pricing.new-list')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <DataTable
                headers={[
                  t('pricing.list'),
                  t('pricing.currency'),
                  t('pricing.items'),
                  t('pricing.status'),
                  t('pricing.actions'),
                ]}
              >
                {visibleLists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell className="font-medium text-gray-900">{list.name}</TableCell>
                    <TableCell className="text-gray-600">{list.currency}</TableCell>
                    <TableCell>{formatNumber(list.item_count)}</TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'inactive' ? 'neutral' : 'success'}>
                        {list.status === 'inactive'
                          ? t('pricing.status-inactive')
                          : t('pricing.status-active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openListEdit(list)}
                          aria-label={`${t('pricing.edit')} ${list.name}`}
                          title={t('pricing.edit')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPrices(list)}
                          aria-label={`${t('pricing.edit-prices-of')} ${list.name}`}
                          title={t('pricing.edit-prices')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                        >
                          <BadgePercent aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteListError(null)
                            setDeletingList(list)
                          }}
                          aria-label={`${t('pricing.delete')} ${list.name}`}
                          title={t('pricing.delete')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Promociones */}
      <TabPanel tabId="promociones" active={tab === 'promociones'}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm text-gray-600">
              {promotions.length === 0
                ? t('pricing.promos-empty')
                : t('pricing.promos-count', { n: promotions.length })}
            </p>
            <Button onClick={openPromoCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t('pricing.new-promo')}
            </Button>
          </div>

          <div className="card">
            <Input
              type="search"
              aria-label={t('pricing.search-promos-label')}
              placeholder={t('pricing.search-promos-placeholder')}
              value={promoSearch}
              onChange={(event) => setPromoSearch(event.target.value)}
            />
          </div>

          {promosError ? (
            <div className="card">
              <ErrorState
                description={promosError}
                action={
                  <Button variant="outline" onClick={reload}>
                    {t('pricing.retry')}
                  </Button>
                }
              />
            </div>
          ) : promosLoading && promotions.length === 0 ? (
            <div className="card">
              <DataTable
                headers={[
                  t('pricing.promotion'),
                  t('pricing.type'),
                  t('pricing.value'),
                  t('pricing.validity'),
                  t('pricing.status'),
                  '',
                ]}
              >
                <TableStateRow colSpan={6}>
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} className="text-loading" />
                    {t('pricing.loading-promos')}
                  </span>
                </TableStateRow>
              </DataTable>
            </div>
          ) : visiblePromos.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Percent}
                title={t('pricing.no-promos-title')}
                description={t('pricing.no-promos-desc')}
                action={
                  <Button onClick={openPromoCreate}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {t('pricing.new-promo')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <DataTable
                headers={[
                  t('pricing.promotion'),
                  t('pricing.type'),
                  t('pricing.value'),
                  t('pricing.validity'),
                  t('pricing.status'),
                  t('pricing.actions'),
                ]}
              >
                {visiblePromos.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{promotion.name}</p>
                      <p className="text-caption text-gray-500">
                        {t('pricing.products-count', { n: promotion.product_count })}
                      </p>
                    </TableCell>
                    <TableCell className="text-gray-600">{KIND_LABELS[promotion.kind]}</TableCell>
                    <TableCell className="font-medium">
                      {promotion.kind === 'percent'
                        ? `${formatNumber(promotion.value)}%`
                        : money(promotion.value, 'PEN')}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {promotion.starts_at ? formatDate(promotion.starts_at) : t('pricing.no-start')} →{' '}
                      {promotion.ends_at ? formatDate(promotion.ends_at) : t('pricing.no-end')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPromotionActive(promotion) ? 'success' : 'neutral'}>
                        {isPromotionActive(promotion)
                          ? t('pricing.status-active')
                          : t('pricing.status-inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openPromoEdit(promotion)}
                          aria-label={`${t('pricing.edit')} ${promotion.name}`}
                          title={t('pricing.edit')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletePromoError(null)
                            setDeletingPromo(promotion)
                          }}
                          aria-label={`${t('pricing.delete')} ${promotion.name}`}
                          title={t('pricing.delete')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Modal: crear/editar lista */}
      <Modal
        open={listOpen}
        onClose={() => !savingList && setListOpen(false)}
        title={editingList ? t('pricing.edit-list-title') : t('pricing.new-list-title')}
        footer={
          <>
            <Button variant="outline" onClick={() => setListOpen(false)} disabled={savingList}>
              {t('pricing.cancel')}
            </Button>
            <Button onClick={handleListSubmit} loading={savingList}>
              {editingList ? t('pricing.save-changes') : t('pricing.create-list')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('pricing.name')}
            required
            value={listForm.name}
            onChange={(event) => setListForm({ ...listForm, name: event.target.value })}
            placeholder={t('pricing.list-name-placeholder')}
            error={listError ?? undefined}
            autoFocus
          />
          <Select
            label={t('pricing.currency')}
            value={listForm.currency}
            onChange={(event) => setListForm({ ...listForm, currency: event.target.value })}
            hint={t('pricing.currency-hint')}
          >
            <option value="PEN">{t('pricing.currency-pen')}</option>
            <option value="USD">{t('pricing.currency-usd')}</option>
          </Select>
        </div>
      </Modal>

      {/* Modal: editar precios por producto */}
      <Modal
        open={pricesOpen}
        onClose={() => !savingPrices && setPricesOpen(false)}
        title={`${t('pricing.edit-prices')}${pricesList ? ` · ${pricesList.name}` : ''}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPricesOpen(false)} disabled={savingPrices}>
              {t('pricing.cancel')}
            </Button>
            <Button onClick={handlePricesSubmit} loading={savingPrices} disabled={pricesLoading}>
              {t('pricing.save-prices')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-gray-600">
            {t('pricing.list-currency-label')} <strong>{pricesList?.currency ?? '—'}</strong>.{' '}
            {t('pricing.list-currency-note')}
          </p>

          {pricesLoading ? (
            <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
              <Spinner size={16} className="text-loading" />
              {t('pricing.loading-prices')}
            </p>
          ) : (
            <div className="space-y-3">
              {priceDraft.map((line, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-8">
                    <Select
                      aria-label={t('pricing.product')}
                      value={line.product_id}
                      onChange={(event) => updatePriceDraft(index, { product_id: event.target.value })}
                    >
                      <option value="">{t('pricing.product-2')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      aria-label={t('pricing.price')}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={line.price}
                      onChange={(event) => updatePriceDraft(index, { price: event.target.value })}
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPriceDraft((previous) =>
                          previous.length > 1
                            ? previous.filter((_, position) => position !== index)
                            : previous,
                        )
                      }
                      aria-label={t('pricing.remove-line')}
                      title={t('pricing.remove-line')}
                      className="flex h-10 w-10 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-error"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPriceDraft((previous) => [...previous, EMPTY_PRICE])}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('pricing.add-product')}
              </Button>
            </div>
          )}

          {pricesError && (
            <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {pricesError}
            </p>
          )}
        </div>
      </Modal>

      {/* Modal: crear/editar promoción */}
      <Modal
        open={promoOpen}
        onClose={() => !savingPromo && setPromoOpen(false)}
        title={editingPromo ? t('pricing.edit-promo-title') : t('pricing.new-promo')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPromoOpen(false)} disabled={savingPromo}>
              {t('pricing.cancel')}
            </Button>
            <Button type="submit" form="promo-form" loading={savingPromo}>
              {editingPromo ? t('pricing.save-changes') : t('pricing.create-promo')}
            </Button>
          </>
        }
      >
        <form id="promo-form" onSubmit={handlePromoSubmit} className="space-y-4">
          <Input
            label={t('pricing.name')}
            required
            value={promoForm.name}
            onChange={(event) => setPromoForm({ ...promoForm, name: event.target.value })}
            placeholder={t('pricing.promo-name-placeholder')}
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('pricing.type')}
              value={promoForm.kind}
              onChange={(event) =>
                setPromoForm({ ...promoForm, kind: event.target.value as PromotionKind })
              }
            >
              <option value="percent">{t('pricing.kind-percent')}</option>
              <option value="fixed">{t('pricing.kind-fixed')}</option>
            </Select>
            <Input
              label={
                promoForm.kind === 'percent' ? t('pricing.value-percent') : t('pricing.value-fixed')
              }
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={promoForm.value}
              onChange={(event) => setPromoForm({ ...promoForm, value: event.target.value })}
              hint={
                promoForm.kind === 'percent'
                  ? t('pricing.value-percent-hint')
                  : t('pricing.value-fixed-hint')
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('pricing.active-from')}
              type="datetime-local"
              value={promoForm.starts_at}
              onChange={(event) => setPromoForm({ ...promoForm, starts_at: event.target.value })}
            />
            <Input
              label={t('pricing.active-to')}
              type="datetime-local"
              value={promoForm.ends_at}
              onChange={(event) => setPromoForm({ ...promoForm, ends_at: event.target.value })}
              hint={t('pricing.no-deadline-hint')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-medium text-gray-700">
              {t('pricing.applicable-products')}<span className="text-error"> *</span>
            </p>
            {products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
                {t('pricing.no-products')}
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                {products.map((product) => (
                  <Checkbox
                    key={product.id}
                    checked={promoProductIds.includes(product.id)}
                    onChange={() => togglePromoProduct(product.id)}
                    label={
                      <>
                        {product.name}{' '}
                        <span className="text-gray-400">({product.sku})</span>
                      </>
                    }
                  />
                ))}
              </div>
            )}
            <p className="text-caption text-gray-500">
              {promoProductIds.length === 0
                ? t('pricing.no-products-selected')
                : t('pricing.selected-count', { n: promoProductIds.length })}
            </p>
          </div>

          {promoError && (
            <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
              {promoError}
            </p>
          )}
        </form>
      </Modal>

      {/* Modal: eliminar lista */}
      <Modal
        open={deletingList !== null}
        onClose={() => setDeletingList(null)}
        title={t('pricing.delete-list-title')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingList(null)}>
              {t('pricing.cancel')}
            </Button>
            <Button variant="danger" onClick={handleListDelete}>
              {t('pricing.delete')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('pricing.delete-list-prefix')} <strong>{deletingList?.name}</strong>?{' '}
          {t('pricing.delete-list-suffix')}
        </p>
        {deleteListError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deleteListError}
          </p>
        )}
      </Modal>

      {/* Modal: eliminar promoción */}
      <Modal
        open={deletingPromo !== null}
        onClose={() => setDeletingPromo(null)}
        title={t('pricing.delete-promo-title')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingPromo(null)}>
              {t('pricing.cancel')}
            </Button>
            <Button variant="danger" onClick={handlePromoDelete}>
              {t('pricing.delete')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('pricing.delete-promo-prefix')} <strong>{deletingPromo?.name}</strong>?{' '}
          {t('pricing.delete-promo-suffix')}
        </p>
        {deletePromoError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deletePromoError}
          </p>
        )}
      </Modal>
    </div>
  )
}
