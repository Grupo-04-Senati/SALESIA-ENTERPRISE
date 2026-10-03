import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Product, ProductInput } from '@/types/product'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/form'
import { minNumber, required, validateForm } from '@/utils/validators'
import type { FormErrors, FormRules } from '@/utils/validators'
import { getProductCategories } from '../services/productService'

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
  cost_price: string
  sale_price: string
  min_stock: string
  unit: string
}

const EMPTY: FormValues = {
  sku: '',
  name: '',
  category_id: '',
  cost_price: '',
  sale_price: '',
  min_stock: '10',
  unit: 'UND',
}

export default function ProductForm({ open, onClose, product, onSubmit }: ProductFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors<FormValues>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(
      product
        ? {
            sku: product.sku,
            name: product.name,
            category_id: String(product.category.id),
            cost_price: String(product.cost_price),
            sale_price: String(product.sale_price),
            min_stock: String(product.min_stock),
            unit: product.unit,
          }
        : { ...EMPTY, category_id: String(getProductCategories()[0]?.id ?? '') },
    )
  }, [open, product])

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
    sku: (value) => required('El SKU es obligatorio')(value),
    name: (value) => required()(value),
    category_id: required('Selecciona una categoría'),
    cost_price: (value) => required('El costo es obligatorio')(value) ?? minNumber(0, 'El costo no puede ser negativo')(value),
    sale_price: (value) => required('El precio de venta es obligatorio')(value) ?? minNumber(0, 'El precio no puede ser negativo')(value),
    min_stock: (value) => required()(value) ?? minNumber(0, 'El stock mínimo no puede ser negativo')(value),
    unit: required(),
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateForm(values, rules)
    // RN-05: venta ≥ costo (regla cruzada entre campos).
    if (!found.sale_price && !found.cost_price && Number(values.sale_price) < Number(values.cost_price)) {
      found.sale_price = 'El precio de venta no puede ser menor al costo.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit({
        sku: values.sku.trim(),
        name: values.name.trim(),
        category_id: Number(values.category_id),
        cost_price: Number(values.cost_price),
        sale_price: Number(values.sale_price),
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
      title={product ? 'Editar producto' : 'Nuevo producto'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={submitting}>
            {product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          required
          placeholder="SKU-0021"
          value={values.sku}
          onChange={setValue('sku')}
          error={errors.sku}
        />

        <div className="sm:col-span-2">
          <Input
            label="Nombre del producto"
            required
            placeholder="Gaseosa 500ml"
            value={values.name}
            onChange={setValue('name')}
            error={errors.name}
          />
        </div>

        <Select
          label="Categoría"
          required
          value={values.category_id}
          onChange={setValue('category_id')}
          error={errors.category_id}
          hint={
            categories.length === 0
              ? 'No hay categorías: créalas primero en el menú Categorías.'
              : undefined
          }
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Input
          label="Unidad"
          required
          placeholder="UND"
          value={values.unit}
          onChange={setValue('unit')}
          error={errors.unit}
        />

        <Input
          label="Precio de costo (S/)"
          required
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={values.cost_price}
          onChange={setValue('cost_price')}
          error={errors.cost_price}
        />

        <Input
          label="Precio de venta (S/)"
          required
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={values.sale_price}
          onChange={setValue('sale_price')}
          error={errors.sale_price}
        />

        <Input
          label="Stock mínimo"
          required
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={values.min_stock}
          onChange={setValue('min_stock')}
          error={errors.min_stock}
        />
      </form>
    </Modal>
  )
}
