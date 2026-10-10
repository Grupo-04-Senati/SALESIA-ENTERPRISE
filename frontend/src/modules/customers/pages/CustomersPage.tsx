import { useEffect, useMemo, useState } from 'react'
import { History, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Pagination from '@/components/tables/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { Input, Select } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/utils/formatters'
import {
  CUSTOMER_SEGMENTS,
  SEGMENT_KEYS,
  createCustomer,
  deactivateCustomer,
  listCustomers,
  updateCustomer,
} from '../services/customerService'
import type { Customer, CustomerInput } from '@/types/customer'
import CustomerForm from '../components/CustomerForm'
import CustomerHistoryModal from '../components/CustomerHistoryModal'
import CustomerStatementModal from '../components/CustomerStatementModal'
import SegmentsPanel from '../components/SegmentsPanel'
import InteractionsPanel from '../components/InteractionsPanel'
import { useDataVersion } from '@/data/DataProvider'
import { useLang } from '@/i18n/i18n'

/**
 * Página de Clientes (Fase 07 · RF-03): listado con búsqueda y filtros,
 * alta/edición con validación, historial y baja lógica.
 * Secciones separadas en pestañas: Directorio · Segmentos · Interacciones.
 * TODO(Fase 05): conectar con /api/v1/customers.
 */

const PAGE_SIZE = 10

export default function CustomersPage() {
  const { t } = useLang()
  const toast = useToast()

  const TAB_ITEMS = [
    { id: 'directorio', label: t('customers.directorio') },
    { id: 'segmentos', label: t('customers.segmentos') },
    { id: 'interacciones', label: t('customers.interacciones') },
  ]

  const STATUS_LABELS: Record<Customer['status'], { variant: 'success' | 'neutral'; label: string }> = {
    active: { variant: 'success', label: t('customers.activo') },
    inactive: { variant: 'neutral', label: t('customers.inactivo') },
  }

  // Listado
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('')
  const [page, setPage] = useState(1)

  // Pestañas de la página
  const [tab, setTab] = useState('directorio')

  // Diálogos
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const version = useDataVersion()
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // Búsqueda con debounce (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, segment, status])

  // Cargar datos
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCustomers({ search: debouncedSearch, segment, status })
      .then((result) => {
        if (!cancelled) setCustomers(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('customers.no-se-pudieron-cargar-los-clientes'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, segment, status, attempt, version])

  const pageCount = Math.max(Math.ceil(customers.length / PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const visible = useMemo(
    () => customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [customers, currentPage],
  )

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setFormOpen(true)
  }

  const handleSubmit = async (input: CustomerInput) => {
    try {
      if (editing) {
        await updateCustomer(editing.id, input)
        toast.success(
          t('customers.cliente-actualizado'),
          `${input.name} ${t('customers.se-guardo-correctamente')}`,
        )
      } else {
        await createCustomer(input)
        toast.success(
          t('customers.cliente-creado'),
          `${input.name} ${t('customers.se-agrego-al-directorio')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('customers.no-se-pudo-guardar'),
        reason instanceof Error ? reason.message : t('customers.error-inesperado'),
      )
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deactivateCustomer(deleting.id)
      toast.success(
        t('customers.cliente-dado-de-baja'),
        `${deleting.name} ${t('customers.paso-a-estado-inactivo')}`,
      )
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      toast.error(
        t('customers.no-se-pudo-dar-de-baja'),
        reason instanceof Error ? reason.message : t('customers.error-inesperado'),
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('customers.clientes')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            {t('customers.directorio-de-clientes-fichas-segmentacion-historial-y-estados-rf-03')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('customers.nuevo-cliente')}
        </Button>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="clientes" />

      {/* Directorio */}
      <TabPanel tabId="directorio" active={tab === 'directorio'}>
      {/* Búsqueda y filtros */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          type="search"
          aria-label={t('customers.buscar-clientes')}
          placeholder={t('customers.buscar-por-nombre-documento-o-correo')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:flex-1"
        />
        <Select
          aria-label={t('customers.filtrar-por-segmento')}
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          className="md:w-44"
        >
          <option value="">{t('customers.todos-los-segmentos')}</option>
          {CUSTOMER_SEGMENTS.map((value) => (
            <option key={value} value={value}>
              {t(SEGMENT_KEYS[value] ?? value)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('customers.filtrar-por-estado')}
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive' | '')}
          className="md:w-40"
        >
          <option value="">{t('customers.todos')}</option>
          <option value="active">{t('customers.activos')}</option>
          <option value="inactive">{t('customers.inactivos')}</option>
        </Select>
      </div>

      {/* Contenido */}
      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('customers.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && customers.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('customers.cliente'), t('customers.documento'), t('customers.segmento'), t('customers.compras'), t('customers.estado'), '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('customers.cargando-clientes')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : customers.length === 0 ? (
        <div className="card">
          <EmptyState
            title={t('customers.sin-clientes')}
            description={t('customers.no-hay-registros-que-coincidan-con-la-busqueda')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('customers.nuevo-cliente')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable headers={[t('customers.cliente'), t('customers.documento'), t('customers.segmento'), t('customers.compras'), t('customers.estado'), t('customers.acciones')]}>
            {visible.map((customer) => {
              const statusLabel = STATUS_LABELS[customer.status]
              return (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-caption text-gray-500">{customer.email}</div>
                    {customer.commercial_line && (
                      <div className="text-caption text-gray-400">{customer.commercial_line}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-caption text-gray-500">{customer.document_type} </span>
                    <span className="font-mono text-body-sm">{customer.document_number}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">{t(SEGMENT_KEYS[customer.segment] ?? customer.segment)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t('customers.n-compras', { n: customer.purchase_count })}</div>
                    <div className="text-caption text-gray-500">
                      {formatCurrency(customer.total_purchased)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusLabel.variant}>{statusLabel.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setStatementCustomer(customer)}
                        aria-label={`${t('customers.estado-de-cuenta-de')} ${customer.name}`}
                        title={t('customers.estado-de-cuenta')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Receipt aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryCustomer(customer)}
                        aria-label={`${t('customers.ver-historial-de')} ${customer.name}`}
                        title={t('customers.ver-historial')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <History aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        aria-label={`${t('customers.editar')} ${customer.name}`}
                        title={t('customers.editar')}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {customer.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => setDeleting(customer)}
                          aria-label={`${t('customers.dar-de-baja-a')} ${customer.name}`}
                          title={t('customers.dar-de-baja')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-error"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </DataTable>

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            total={customers.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
      </TabPanel>

      {/* Segmentos */}
      <TabPanel tabId="segmentos" active={tab === 'segmentos'}>
        <SegmentsPanel />
      </TabPanel>

      {/* Interacciones */}
      <TabPanel tabId="interacciones" active={tab === 'interacciones'}>
        <InteractionsPanel />
      </TabPanel>

      {/* Alta / edición */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
        onSubmit={handleSubmit}
      />

      {/* Historial */}
      <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />

      {/* Estado de cuenta */}
      <CustomerStatementModal
        customer={statementCustomer}
        onClose={() => setStatementCustomer(null)}
      />

      {/* Confirmación de baja */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('customers.dar-de-baja-cliente')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              {t('customers.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              {t('customers.dar-de-baja')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-600">
          {t('customers.el-cliente')}{' '}
          <span className="font-semibold text-gray-900">{deleting?.name}</span>{' '}
          {t('customers.quedara-en-estado-inactivo-baja-logica-su-historial-de-compras-se-conserva')}
        </p>
      </Modal>
    </div>
  )
}
