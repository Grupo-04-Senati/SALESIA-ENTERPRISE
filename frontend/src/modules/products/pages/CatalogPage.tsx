import { useState } from 'react'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { useLang } from '@/i18n/i18n'
import ProductsPage from './ProductsPage'
import CategoriesPage from '@/modules/categories/pages/CategoriesPage'
import UnitsPanel from '@/modules/inventory/components/UnitsPanel'

/**
 * Módulo Catálogo: pestañas de Productos, Categorías y Unidades de medida.
 * Antes eran tres nav-items separados; se unen aquí para simplificar el menú
 * (categorías y unidades son catálogos auxiliares de productos).
 */
export default function CatalogPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('productos')

  const TAB_ITEMS = [
    { id: 'productos', label: t('products.tab-productos') },
    { id: 'categorias', label: t('products.tab-categorias') },
    { id: 'unidades', label: t('products.tab-unidades') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('products.catalogo')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">{t('products.catalogo-desc')}</p>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="catalogo" />

      <TabPanel tabId="productos" active={tab === 'productos'}>
        <ProductsPage />
      </TabPanel>
      <TabPanel tabId="categorias" active={tab === 'categorias'}>
        <CategoriesPage />
      </TabPanel>
      <TabPanel tabId="unidades" active={tab === 'unidades'}>
        <UnitsPanel />
      </TabPanel>
    </div>
  )
}
