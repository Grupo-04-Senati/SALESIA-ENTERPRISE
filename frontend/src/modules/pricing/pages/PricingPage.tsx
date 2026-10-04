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

const TAB_ITEMS = [
  { id: 'listas', label: 'Listas de precios' },
  { id: 'promociones', label: 'Promociones' },
]

const KIND_LABELS: Record<PromotionKind, string> = {
  percent: 'Porcentaje (%)',
  fixed: 'Monto fijo (S/)',
}

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
  const version = useDataVersion()

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
          setListsError(reason instanceof Error ? reason.message : 'No se pudieron cargar las listas')
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
            reason instanceof Error ? reason.message : 'No se pudieron cargar las promociones',
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
      setListError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    setListError(null)
    setSavingList(true)
    try {
      if (editingList) {
        await updatePriceList(editingList.id, { name, currency: listForm.currency })
        toast.success('Lista actualizada', `${name} se guardó correctamente.`)
      } else {
        await createPriceList({ name, currency: listForm.currency })
        toast.success('Lista creada', `${name} ya está disponible para asignar precios.`)
      }
      setListOpen(false)
      reload()
    } catch (reason: unknown) {
      setListError(reason instanceof Error ? reason.message : 'No se pudo guardar la lista.')
    } finally {
      setSavingList(false)
    }
  }

  const handleListDelete = async () => {
    if (!deletingList) return
    setDeleteListError(null)
    try {
      await deletePriceList(deletingList.id)
      toast.success('Lista eliminada', `${deletingList.name} se quitó del catálogo.`)
      setDeletingList(null)
      reload()
    } catch (reason: unknown) {
      setDeleteListError(reason instanceof Error ? reason.message : 'No se pudo eliminar la lista.')
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
          reason instanceof Error ? reason.message : 'No se pudieron cargar los precios.',
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
        setPricesError('Ingresa un precio válido (0 o más) para cada producto.')
        return
      }
      const productId = Number(line.product_id)
      if (seen.has(productId)) {
        setPricesError('Cada producto solo puede aparecer una vez en la lista.')
        return
      }
      seen.add(productId)
      items.push({ product_id: productId, price })
    }
    if (items.length === 0) {
      setPricesError('Agrega al menos un producto con su precio.')
      return
    }
    setPricesError(null)
    setSavingPrices(true)
    try {
      await replacePriceListItems(pricesList.id, items)
      toast.success('Precios actualizados', `${pricesList.name}: ${items.length} producto(s) guardados.`)
      setPricesOpen(false)
      reload()
    } catch (reason: unknown) {
      setPricesError(reason instanceof Error ? reason.message : 'No se pudieron guardar los precios.')
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
      setPromoError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (promoForm.value.trim() === '' || Number.isNaN(value) || value <= 0) {
      setPromoError('Ingresa un valor mayor a 0.')
      return
    }
    if (promoForm.kind === 'percent' && value > 100) {
      setPromoError('El valor de un porcentaje no puede superar 100.')
      return
    }
    if (promoForm.starts_at && promoForm.ends_at) {
      if (new Date(promoForm.starts_at).getTime() >= new Date(promoForm.ends_at).getTime()) {
        setPromoError('La fecha de inicio debe ser anterior a la fecha de fin.')
        return
      }
    }
    if (promoProductIds.length === 0) {
      setPromoError('Selecciona al menos un producto para la promoción.')
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
        toast.success('Promoción actualizada', `${name} se guardó correctamente.`)
      } else {
        await createPromotion(input)
        toast.success('Promoción creada', `${name} ya está aplicando a los productos marcados.`)
      }
      setPromoOpen(false)
      reload()
    } catch (reason: unknown) {
      setPromoError(
        reason instanceof Error ? reason.message : 'No se pudo guardar la promoción.',
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
      toast.success('Promoción eliminada', `${deletingPromo.name} se quitó del listado.`)
      setDeletingPromo(null)
      reload()
    } catch (reason: unknown) {
      setDeletePromoError(
        reason instanceof Error ? reason.message : 'No se pudo eliminar la promoción.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Precios y promociones</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Listas de precios por producto y promociones vigentes (porcentaje o monto fijo) para
          todo el catálogo.
        </p>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="precios" />

      {/* Listas de precios */}
      <TabPanel tabId="listas" active={tab === 'listas'}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm text-gray-600">
              {lists.length === 0
                ? 'Aún no hay listas de precios.'
                : `${formatNumber(lists.length)} lista(s) registrada(s).`}
            </p>
            <Button onClick={openListCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Nueva lista
            </Button>
          </div>

          <div className="card">
            <Input
              type="search"
              aria-label="Buscar listas"
              placeholder="Buscar lista…"
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
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : listsLoading && lists.length === 0 ? (
            <div className="card">
              <DataTable headers={['Lista', 'Moneda', 'Ítems', 'Estado', '']}>
                <TableStateRow colSpan={5}>
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} className="text-loading" />
                    Cargando listas…
                  </span>
                </TableStateRow>
              </DataTable>
            </div>
          ) : visibleLists.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Tags}
                title="Sin listas de precios"
                description="Crea una lista para asignar precios específicos a tus productos."
                action={
                  <Button onClick={openListCreate}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Nueva lista
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <DataTable headers={['Lista', 'Moneda', 'Ítems', 'Estado', 'Acciones']}>
                {visibleLists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell className="font-medium text-gray-900">{list.name}</TableCell>
                    <TableCell className="text-gray-600">{list.currency}</TableCell>
                    <TableCell>{formatNumber(list.item_count)}</TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'inactive' ? 'neutral' : 'success'}>
                        {list.status === 'inactive' ? 'Inactiva' : 'Activa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openListEdit(list)}
                          aria-label={`Editar ${list.name}`}
                          title="Editar"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPrices(list)}
                          aria-label={`Editar precios de ${list.name}`}
                          title="Editar precios"
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
                          aria-label={`Eliminar ${list.name}`}
                          title="Eliminar"
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
                ? 'Aún no hay promociones.'
                : `${formatNumber(promotions.length)} promoción(es) registrada(s).`}
            </p>
            <Button onClick={openPromoCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Nueva promoción
            </Button>
          </div>

          <div className="card">
            <Input
              type="search"
              aria-label="Buscar promociones"
              placeholder="Buscar promoción…"
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
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : promosLoading && promotions.length === 0 ? (
            <div className="card">
              <DataTable headers={['Promoción', 'Tipo', 'Valor', 'Vigencia', 'Estado', '']}>
                <TableStateRow colSpan={6}>
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} className="text-loading" />
                    Cargando promociones…
                  </span>
                </TableStateRow>
              </DataTable>
            </div>
          ) : visiblePromos.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Percent}
                title="Sin promociones"
                description="Crea una promoción de porcentaje o monto fijo y elige a qué productos aplica."
                action={
                  <Button onClick={openPromoCreate}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Nueva promoción
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <DataTable headers={['Promoción', 'Tipo', 'Valor', 'Vigencia', 'Estado', 'Acciones']}>
                {visiblePromos.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{promotion.name}</p>
                      <p className="text-caption text-gray-500">
                        {formatNumber(promotion.product_count)} producto(s)
                      </p>
                    </TableCell>
                    <TableCell className="text-gray-600">{KIND_LABELS[promotion.kind]}</TableCell>
                    <TableCell className="font-medium">
                      {promotion.kind === 'percent'
                        ? `${formatNumber(promotion.value)}%`
                        : money(promotion.value, 'PEN')}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {promotion.starts_at ? formatDate(promotion.starts_at) : 'Sin inicio'} →{' '}
                      {promotion.ends_at ? formatDate(promotion.ends_at) : 'Sin fin'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPromotionActive(promotion) ? 'success' : 'neutral'}>
                        {isPromotionActive(promotion) ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openPromoEdit(promotion)}
                          aria-label={`Editar ${promotion.name}`}
                          title="Editar"
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
                          aria-label={`Eliminar ${promotion.name}`}
                          title="Eliminar"
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
        title={editingList ? 'Editar lista de precios' : 'Nueva lista de precios'}
        footer={
          <>
            <Button variant="outline" onClick={() => setListOpen(false)} disabled={savingList}>
              Cancelar
            </Button>
            <Button onClick={handleListSubmit} loading={savingList}>
              {editingList ? 'Guardar cambios' : 'Crear lista'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            required
            value={listForm.name}
            onChange={(event) => setListForm({ ...listForm, name: event.target.value })}
            placeholder="Ej. Lista mayorista"
            error={listError ?? undefined}
            autoFocus
          />
          <Select
            label="Moneda"
            value={listForm.currency}
            onChange={(event) => setListForm({ ...listForm, currency: event.target.value })}
            hint="Se usa para mostrar los precios de esta lista."
          >
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dólares (US$)</option>
          </Select>
        </div>
      </Modal>

      {/* Modal: editar precios por producto */}
      <Modal
        open={pricesOpen}
        onClose={() => !savingPrices && setPricesOpen(false)}
        title={`Editar precios${pricesList ? ` · ${pricesList.name}` : ''}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPricesOpen(false)} disabled={savingPrices}>
              Cancelar
            </Button>
            <Button onClick={handlePricesSubmit} loading={savingPrices} disabled={pricesLoading}>
              Guardar precios
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-gray-600">
            Moneda de la lista: <strong>{pricesList?.currency ?? '—'}</strong>. Al guardar se
            reemplazan todas las líneas de la lista.
          </p>

          {pricesLoading ? (
            <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
              <Spinner size={16} className="text-loading" />
              Cargando precios…
            </p>
          ) : (
            <div className="space-y-3">
              {priceDraft.map((line, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-8">
                    <Select
                      aria-label="Producto"
                      value={line.product_id}
                      onChange={(event) => updatePriceDraft(index, { product_id: event.target.value })}
                    >
                      <option value="">Producto…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      aria-label="Precio"
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
                      aria-label="Quitar línea"
                      title="Quitar línea"
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
                Agregar producto
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
        title={editingPromo ? 'Editar promoción' : 'Nueva promoción'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPromoOpen(false)} disabled={savingPromo}>
              Cancelar
            </Button>
            <Button type="submit" form="promo-form" loading={savingPromo}>
              {editingPromo ? 'Guardar cambios' : 'Crear promoción'}
            </Button>
          </>
        }
      >
        <form id="promo-form" onSubmit={handlePromoSubmit} className="space-y-4">
          <Input
            label="Nombre"
            required
            value={promoForm.name}
            onChange={(event) => setPromoForm({ ...promoForm, name: event.target.value })}
            placeholder="Ej. Semana del cliente"
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo"
              value={promoForm.kind}
              onChange={(event) =>
                setPromoForm({ ...promoForm, kind: event.target.value as PromotionKind })
              }
            >
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Monto fijo (S/)</option>
            </Select>
            <Input
              label={promoForm.kind === 'percent' ? 'Valor (%)' : 'Valor (S/)'}
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={promoForm.value}
              onChange={(event) => setPromoForm({ ...promoForm, value: event.target.value })}
              hint={promoForm.kind === 'percent' ? 'Máximo 100.' : 'Descuento en soles.'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Vigente desde"
              type="datetime-local"
              value={promoForm.starts_at}
              onChange={(event) => setPromoForm({ ...promoForm, starts_at: event.target.value })}
            />
            <Input
              label="Vigente hasta"
              type="datetime-local"
              value={promoForm.ends_at}
              onChange={(event) => setPromoForm({ ...promoForm, ends_at: event.target.value })}
              hint="Vacío = sin fecha límite."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-medium text-gray-700">
              Productos aplicables<span className="text-error"> *</span>
            </p>
            {products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-body-sm text-gray-400">
                No hay productos registrados. Crea productos para poder promocionarlos.
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
                ? 'Ningún producto seleccionado.'
                : `${promoProductIds.length} producto(s) seleccionado(s).`}
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
        title="Eliminar lista de precios"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingList(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleListDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar la lista <strong>{deletingList?.name}</strong>? Se quitarán también sus precios.
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
        title="Eliminar promoción"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingPromo(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handlePromoDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          ¿Eliminar la promoción <strong>{deletingPromo?.name}</strong>? Dejará de aplicar a sus
          productos.
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
