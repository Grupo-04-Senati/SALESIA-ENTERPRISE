import { useCallback, useEffect, useState } from 'react'
import type { Product } from '@/types/product'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import { Input, Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { useDataVersion } from '@/data/DataProvider'
import {
  addKitComponent,
  listKitComponents,
  removeKitComponent,
} from '../services/productService'
import type { KitComponent } from '../services/productService'
import { getSaleProducts } from '@/modules/sales/services/saleService'

/**
 * Panel de componentes de un kit/combo (RF-04).
 * Vender el kit descuenta el stock de sus componentes en el backend.
 */

interface KitModalProps {
  /** Producto kit seleccionado (null = cerrado). */
  product: Product | null
  onClose: () => void
}

export default function KitModal({ product, onClose }: KitModalProps) {
  const { t } = useLang()
  const toast = useToast()
  const version = useDataVersion()
  const allProducts = getSaleProducts()

  const [components, setComponents] = useState<KitComponent[] | null>(null)
  const [componentId, setComponentId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!product) return
    setComponents(null)
    listKitComponents(product.id)
      .then((response) => setComponents(response.components))
      .catch(() => setComponents([]))
  }, [product])

  useEffect(() => {
    if (!product) {
      setComponents(null)
      setComponentId('')
      setQuantity('1')
      return
    }
    load()
  }, [product, load, version])

  const handleAdd = async () => {
    if (!product) return
    const parsed = Number(quantity)
    if (!componentId || !Number.isInteger(parsed) || parsed < 1) {
      toast.error(t('products.kit-cantidad-invalida'), t('products.kit-selecciona-componente'))
      return
    }
    setBusy(true)
    try {
      await addKitComponent(product.id, Number(componentId), parsed)
      toast.success(t('products.kit-componente-guardado'), t('products.kit-listo'))
      setComponentId('')
      setQuantity('1')
      load()
    } catch (reason: unknown) {
      toast.error(
        t('products.kit-no-se-pudo-guardar'),
        reason instanceof Error ? reason.message : t('products.error-inesperado'),
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (component: KitComponent) => {
    if (!product) return
    setBusy(true)
    try {
      await removeKitComponent(product.id, component.component_id)
      toast.success(t('products.kit-componente-quitado'), component.name)
      load()
    } catch (reason: unknown) {
      toast.error(
        t('products.kit-no-se-pudo-quitar'),
        reason instanceof Error ? reason.message : t('products.error-inesperado'),
      )
    } finally {
      setBusy(false)
    }
  }

  const candidates = allProducts.filter((entry) => entry.id !== product?.id)

  return (
    <Modal
      open={product !== null}
      onClose={onClose}
      title={product ? `${t('products.kit')} — ${product.name}` : t('products.kit')}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-body-sm text-gray-600">{t('products.kit-explicacion')}</p>

        {/* Agregar componente */}
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <Select
              aria-label={t('products.kit-componente')}
              value={componentId}
              onChange={(event) => setComponentId(event.target.value)}
            >
              <option value="">{t('products.kit-selecciona-componente')}</option>
              {candidates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.sku})
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Input
              aria-label={t('products.kit-cantidad')}
              type="number"
              min="1"
              max="9999"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={handleAdd} loading={busy} className="w-full">
              {t('products.kit-agregar')}
            </Button>
          </div>
        </div>

        {/* Lista de componentes */}
        {components === null ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner className="text-loading" />
          </div>
        ) : components.length === 0 ? (
          <EmptyState
            title={t('products.kit-sin-componentes')}
            description={t('products.kit-agrega-componentes')}
          />
        ) : (
          <DataTable headers={[t('products.kit-componente'), t('products.kit-cantidad'), '']}>
            {components.map((component) => (
              <TableRow key={component.id}>
                <TableCell>
                  <span className="font-medium text-gray-900">{component.name}</span>
                  <span className="ml-2 font-mono text-caption text-gray-500">{component.sku}</span>
                </TableCell>
                <TableCell>
                  {component.quantity} {component.unit}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={() => handleRemove(component)}
                    disabled={busy}
                    aria-label={`${t('products.kit-quitar')} ${component.name}`}
                    className="text-caption text-gray-400 transition-colors hover:text-error"
                  >
                    {t('products.kit-quitar')}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </div>
    </Modal>
  )
}
