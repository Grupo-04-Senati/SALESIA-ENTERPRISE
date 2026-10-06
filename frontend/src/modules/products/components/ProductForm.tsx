import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Image as ImageIcon, Upload, X } from 'lucide-react'
import type { Product, ProductInput } from '@/types/product'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import {
  cleanText,
  code,
  hasLetter,
  integer,
  maxDecimals,
  maxLength,
  minLength,
  minNumber,
  numberRange,
  required,
  validateForm,
} from '@/utils/validators'
import type { FormErrors, FormRules } from '@/utils/validators'
import { getProductCategories, uploadProductImage } from '../services/productService'
import { useLang } from '@/i18n/i18n'

/**
 * Formulario de producto crear/editar en modal (RF-04).
 * Validación: SKU único, venta ≥ costo (RN-05), stock ≥ 0.
 */

interface ProductFormProps {
  open: boolean
  onClose: () => void
  /** Producto a editar; `null` = crear nuevo. */
  product: Product | null
  onSubmit: (input: ProductInput) => Promise<void>
}

interface FormValues extends Record<string, string> {
  sku: string
  name: string
  category_id: string
  description: string
  cost_price: string
  sale_price: string
  wholesale_price: string
  brand: string
  min_stock: string
  unit: string
}

const EMPTY: FormValues = {
  sku: '',
  name: '',
  category_id: '',
  description: '',
  cost_price: '',
  sale_price: '',
  wholesale_price: '',
  brand: '',
  min_stock: '10',
  unit: 'UND',
}

export default function ProductForm({ open, onClose, product, onSubmit }: ProductFormProps) {
  const { t } = useLang()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<FormValues>>({})
  const [submitting, setSubmitting] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [featured, setFeatured] = useState(false)
  const imageRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setImageError(null)
    setValues(
      product
        ? {
            sku: product.sku,
            name: product.name,
            category_id: product.category ? String(product.category.id) : '',
            description: product.description ?? '',
            cost_price: String(product.cost_price),
            sale_price: String(product.sale_price),
            wholesale_price:
              product.wholesale_price === null || product.wholesale_price === undefined
                ? ''
                : String(product.wholesale_price),
            brand: product.brand ?? '',
            min_stock: String(product.min_stock),
            unit: product.unit,
          }
        : { ...EMPTY, category_id: String(getProductCategories()[0]?.id ?? '') },
    )
    setImageUrl(product?.image_url ?? null)
    setFeatured(product?.is_featured ?? false)
  }, [open, product])

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImageError(null)
    setUploadingImage(true)
    try {
      setImageUrl(await uploadProductImage(file))
    } catch (error) {
      setImageError(
        error instanceof Error && error.message
          ? `${t('products.no-se-pudo-subir-la-imagen')}: ${error.message}`
          : t('products.no-se-pudo-subir-la-imagen'),
      )
    } finally {
      setUploadingImage(false)
    }
  }

  const categories = getProductCategories()

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

  const rules: FormRules<FormValues> = {
    sku: (value) => required(t('products.el-sku-es-obligatorio'))(value) ?? code(30)(value),
    name: (value) =>
      required(t('products.este-campo-es-obligatorio'))(value) ??
      minLength(2)(value) ??
      maxLength(150)(value) ??
      hasLetter()(value),
    category_id: required(t('products.selecciona-una-categoria')),
    cost_price: (value) =>
      required(t('products.el-costo-es-obligatorio'))(value) ??
      minNumber(0, t('products.el-costo-no-puede-ser-negativo'))(value) ??
      maxDecimals(2)(value) ??
      numberRange(0, 100000000)(value),
    sale_price: (value) =>
      required(t('products.el-precio-de-venta-es-obligatorio'))(value) ??
      minNumber(0, t('products.el-precio-no-puede-ser-negativo'))(value) ??
      maxDecimals(2)(value) ??
      numberRange(0, 100000000)(value),
    wholesale_price: (value) =>
      value.trim() === ''
        ? null
        : minNumber(0, t('products.el-precio-no-puede-ser-negativo'))(value) ??
          maxDecimals(2)(value) ??
          numberRange(0, 100000000)(value),
    brand: (value) => (value.trim() === '' ? null : maxLength(100)(value)),
    description: (value) => (value.trim() === '' ? null : maxLength(500)(value)),
    min_stock: (value) =>
      required(t('products.este-campo-es-obligatorio'))(value) ??
      minNumber(0, t('products.el-stock-minimo-no-puede-ser-negativo'))(value) ??
      integer(0, 999999)(value),
    unit: (value) => required(t('products.este-campo-es-obligatorio'))(value) ?? maxLength(20)(value),
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateForm(values, rules)
    // RN-05: venta ≥ costo (regla cruzada entre campos).
    if (!found.sale_price && !found.cost_price && Number(values.sale_price) < Number(values.cost_price)) {
      found.sale_price = t('products.el-precio-de-venta-no-puede-ser-menor-al-costo')
    }
    // El precio mayorista nunca puede superar al precio de venta.
    if (
      !found.wholesale_price &&
      !found.sale_price &&
      values.wholesale_price.trim() !== '' &&
      Number(values.wholesale_price) > Number(values.sale_price)
    ) {
      found.wholesale_price = t('products.el-precio-mayorista-no-puede-ser-mayor')
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({
        sku: values.sku.trim(),
        name: cleanText(values.name),
        category_id: Number(values.category_id),
        description: values.description.trim() || null,
        cost_price: Number(values.cost_price),
        sale_price: Number(values.sale_price),
        wholesale_price:
          values.wholesale_price.trim() === '' ? null : Number(values.wholesale_price),
        brand: values.brand.trim() || null,
        image_url: imageUrl,
        is_featured: featured,
        min_stock: Number(values.min_stock),
        unit: values.unit.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? t('products.editar-producto') : t('products.nuevo-producto')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('products.cancelar')}
          </Button>
          <Button type="submit" form="product-form" loading={submitting}>
            {product ? t('products.guardar-cambios') : t('products.crear-producto')}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('products.sku')}
          required
          maxLength={30}
          placeholder="SKU-0021"
          value={values.sku}
          onChange={setValue('sku')}
          error={errors.sku}
        />

        <div className="sm:col-span-2">
          <Input
            label={t('products.nombre-del-producto')}
            required
            minLength={2}
            maxLength={150}
            placeholder={t('products.gaseosa-500ml')}
            value={values.name}
            onChange={setValue('name')}
            error={errors.name}
          />
        </div>

        <Select
          label={t('products.categoria')}
          required
          value={values.category_id}
          onChange={setValue('category_id')}
          error={errors.category_id}
          hint={
            categories.length === 0 ? t('products.no-hay-categorias-crealas-primero-en-el-menu-categorias') : undefined
          }
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Input
          label={t('products.unidad')}
          required
          maxLength={20}
          placeholder="UND"
          value={values.unit}
          onChange={setValue('unit')}
          error={errors.unit}
        />

        <Input
          label={t('products.marca')}
          maxLength={100}
          placeholder="Truper"
          value={values.brand}
          onChange={setValue('brand')}
          error={errors.brand}
        />

        <div className="flex items-end pb-1">
          <Checkbox
            label={t('products.destacado-en-la-tienda')}
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
          />
        </div>

        <Input
          label={t('products.precio-de-costo')}
          required
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          inputMode="decimal"
          value={values.cost_price}
          onChange={setValue('cost_price')}
          error={errors.cost_price}
        />

        <Input
          label={t('products.precio-de-venta')}
          required
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          inputMode="decimal"
          value={values.sale_price}
          onChange={setValue('sale_price')}
          error={errors.sale_price}
        />

        <Input
          label={t('products.precio-mayorista')}
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          inputMode="decimal"
          placeholder="—"
          value={values.wholesale_price}
          onChange={setValue('wholesale_price')}
          error={errors.wholesale_price}
          hint={t('products.vacio-consultar-precio-mayorista')}
        />

        <Input
          label={t('products.stock-minimo')}
          required
          type="number"
          min="0"
          max="999999"
          step="1"
          inputMode="numeric"
          value={values.min_stock}
          onChange={setValue('min_stock')}
          error={errors.min_stock}
        />

        <div className="sm:col-span-2">
          <Textarea
            label={t('products.descripcion')}
            maxLength={500}
            placeholder={t('products.gaseosa-500ml')}
            value={values.description}
            onChange={setValue('description')}
            error={errors.description}
          />
        </div>

        <div className="sm:col-span-2">
          <Field label={t('products.imagen')} error={imageError ?? undefined}>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon aria-hidden="true" className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <input
                ref={imageRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={handleImageFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageRef.current?.click()}
                disabled={uploadingImage}
                loading={uploadingImage}
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                {uploadingImage ? t('products.cambiando-imagen') : t('products.subir-imagen')}
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setImageUrl(null)
                    setImageError(null)
                  }}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  {t('products.quitar-imagen')}
                </Button>
              )}
            </div>
          </Field>
        </div>
      </form>
    </Modal>
  )
}
