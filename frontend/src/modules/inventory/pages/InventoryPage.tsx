import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Pagination from '@/components/tables/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Checkbox, Input } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/utils/formatters'
import type { InventoryMovement, MovementType } from '@/types/sale'
import { useLang } from '@/i18n/i18n'
import { createMovement, listMovements, listStock } from '../services/inventoryService'
import type { MovementInput, StockRow } from '../services/inventoryService'
import MovementForm from '../components/MovementForm'
import StockCountsPanel from '../components/StockCountsPanel'
import WarehousesPanel from '../components/WarehousesPanel'
import UnitsPanel from '../components/UnitsPanel'
import BranchesPanel from '../components/BranchesPanel'
import ProcessTraceList from '@/components/ProcessTraceList'
import { isLowStock } from '@/data/store'
import { useDataVersion } from '@/data/DataProvider'

/**
 * Página de Inventario (Fase 08 · RF-08): secciones en pestañas —
 * Existencias (stock, alertas), Movimientos (kardex), Conteos,
 * Almacenes, Unidades y Sucursales.
 * TODO(Fase 05): conectar con /api/v1/inventory.
 */

const PAGE_SIZE = 10

const MOVEMENT_KEYS: Record<MovementType, string> = {
  IN: 'inventory.entrada',
  OUT: 'inventory.salida',
  RETURN: 'inventory.devolucion',
  SHRINKAGE: 'inventory.merma',
  ADJUSTMENT: 'inventory.ajuste',
}

export default function InventoryPage() {
  const { t } = useLang()
  const toast = useToast()

  const TAB_ITEMS = [
    { id: 'existencias', label: t('inventory.existencias') },
    { id: 'movimientos', label: t('inventory.movimientos') },
    { id: 'conteos', label: t('inventory.conteos') },
    { id: 'almacenes', label: t('inventory.almacenes') },
    { id: 'unidades', label: t('inventory.unidades') },
    { id: 'sucursales', label: t('inventory.sucursales') },
  ]

  const [stock, setStock] = useState<StockRow[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [search, setSearch] = useState('')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState('existencias')
  const version = useDataVersion()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([listStock(), listMovements()])
      .then(([stockRows, movementRows]) => {
        if (cancelled) return
        setStock(stockRows)
        setMovements(movementRows)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : t('inventory.no-se-pudo-cargar-el-inventario'),
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

  // El umbral de alerta viene de la regla ALERTA_STOCK (Automatizaciones).
  const alerts = useMemo(() => stock.filter((row) => isLowStock(row)), [stock])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stock.filter(
      (row) =>
        (!onlyAlerts || row.current_stock <= row.min_stock) &&
        (term === '' || row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)),
    )
  }, [stock, search, onlyAlerts])

  useEffect(() => {
    setPage(1)
  }, [search, onlyAlerts])

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const visible = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  )

  const reload = () => setAttempt((value) => value + 1)

  const handleSubmit = async (input: MovementInput) => {
    try {
      const { movement } = await createMovement(input)
      toast.success(
        t('inventory.movimiento-registrado'),
        `${t(MOVEMENT_KEYS[movement.type])} · ${movement.sku} → ${movement.resulting_stock} ${t('inventory.und')}`,
      )
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('inventory.no-se-pudo-registrar'),
        reason instanceof Error ? reason.message : t('inventory.error-inesperado'),
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('inventory.inventario')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            {t('inventory.existencias-alertas-de-stock-y-kardex-de-movimientos-rf-08')}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('inventory.nuevo-movimiento')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('inventory.reintentar')}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="inventario" />

          {/* Existencias */}
          <TabPanel tabId="existencias" active={tab === 'existencias'}>
            <div className="space-y-4">
              {/* Alertas */}
              <div className="card flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle aria-hidden="true" className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-body-sm font-semibold text-gray-900">
                      {t('inventory.productos-en-alerta-de-stock', { n: alerts.length })}
                    </p>
                    <p className="text-caption text-gray-500">
                      {t(
                        'inventory.alerta-segun-el-umbral-configurado-en-automatizaciones-regla-alerta-stock',
                      )}
                    </p>
                  </div>
                </div>
                <Checkbox
                  label={t('inventory.solo-productos-con-alerta')}
                  checked={onlyAlerts}
                  onChange={(event) => setOnlyAlerts(event.target.checked)}
                />
              </div>

              <Input
                type="search"
                aria-label={t('inventory.buscar-productos-en-inventario')}
                placeholder={t('inventory.buscar-por-nombre-o-sku')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {loading && stock.length === 0 ? (
                <div className="card">
                  <DataTable
                    headers={[
                      t('inventory.producto'),
                      t('inventory.categoria'),
                      t('inventory.stock'),
                      t('inventory.minimo'),
                      t('inventory.estado'),
                    ]}
                  >
                    <TableStateRow colSpan={5}>
                      <span className="inline-flex items-center gap-2">
                        <Spinner size={16} className="text-loading" />
                        {t('inventory.cargando-inventario')}
                      </span>
                    </TableStateRow>
                  </DataTable>
                </div>
              ) : filtered.length === 0 ? (
                <div className="card">
                  <EmptyState
                    title={t('inventory.sin-existencias')}
                    description={t('inventory.no-hay-productos-que-coincidan-con-el-filtro')}
                  />
                </div>
              ) : (
                <>
                  <DataTable
                    headers={[
                      t('inventory.producto'),
                      t('inventory.categoria'),
                      t('inventory.stock'),
                      t('inventory.minimo'),
                      t('inventory.estado'),
                    ]}
                  >
                    {visible.map((row) => {
                      const isEmpty = row.current_stock === 0
                      const isLow = !isEmpty && isLowStock(row)
                      return (
                        <TableRow key={row.product_id}>
                          <TableCell>
                            <div className="font-medium text-gray-900">{row.name}</div>
                            <div className="font-mono text-caption text-gray-500">{row.sku}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="primary">{row.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.current_stock} {row.unit}
                          </TableCell>
                          <TableCell className="text-gray-500">{row.min_stock}</TableCell>
                          <TableCell>
                            {isEmpty ? (
                              <Badge variant="error">{t('inventory.sin-stock')}</Badge>
                            ) : isLow ? (
                              <Badge variant="warning">{t('inventory.stock-bajo')}</Badge>
                            ) : (
                              <Badge variant="success">{t('inventory.disponible')}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </DataTable>
                  <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
                </>
              )}
            </div>
          </TabPanel>

          {/* Kardex */}
          <TabPanel tabId="movimientos" active={tab === 'movimientos'}>
            <div className="space-y-4">
              <h2>{t('inventory.movimientos-recientes')}</h2>
              {movements.length === 0 ? (
                <div className="card">
                  <EmptyState
                    title={t('inventory.sin-movimientos')}
                    description={t('inventory.aun-no-hay-entradas-ni-salidas-registradas')}
                    action={
                      <Button onClick={() => setFormOpen(true)}>
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        {t('inventory.nuevo-movimiento')}
                      </Button>
                    }
                  />
                </div>
              ) : (
                <DataTable
                  headers={[
                    t('inventory.fecha'),
                    t('inventory.producto'),
                    t('inventory.tipo'),
                    t('inventory.cantidad'),
                    t('inventory.stock-resultante'),
                    t('inventory.motivo'),
                    t('inventory.usuario'),
                  ]}
                >
                  {movements.slice(0, 8).map((movement) => {
                    const isIn = movement.type === 'IN' || movement.type === 'RETURN'
                    const Icon = isIn ? TrendingUp : TrendingDown
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>{formatDateTime(movement.created_at)}</TableCell>
                        <TableCell className="font-mono text-caption">{movement.sku}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 text-caption font-medium ${isIn ? 'text-success' : 'text-error'}`}
                          >
                            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                            {t(MOVEMENT_KEYS[movement.type])}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {isIn ? '+' : '−'}
                          {movement.quantity}
                        </TableCell>
                        <TableCell>{movement.resulting_stock}</TableCell>
                        <TableCell className="max-w-56 truncate text-gray-600">{movement.reason}</TableCell>
                        <TableCell className="text-gray-600">
                          {movement.user?.name ?? t('inventory.sistema')}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </DataTable>
              )}

              {/* Trazabilidad de movimientos */}
              <ProcessTraceList limit={3} title={t('inventory.procesos-ejecutados-en-inventario')} />
            </div>
          </TabPanel>

          {/* Conteos */}
          <TabPanel tabId="conteos" active={tab === 'conteos'}>
            <StockCountsPanel />
          </TabPanel>

          {/* Almacenes */}
          <TabPanel tabId="almacenes" active={tab === 'almacenes'}>
            <WarehousesPanel />
          </TabPanel>

          {/* Unidades */}
          <TabPanel tabId="unidades" active={tab === 'unidades'}>
            <UnitsPanel />
          </TabPanel>

          {/* Sucursales */}
          <TabPanel tabId="sucursales" active={tab === 'sucursales'}>
            <BranchesPanel />
          </TabPanel>
        </>
      )}

      <MovementForm open={formOpen} onClose={() => setFormOpen(false)} stock={stock} onSubmit={handleSubmit} />
    </div>
  )
}
