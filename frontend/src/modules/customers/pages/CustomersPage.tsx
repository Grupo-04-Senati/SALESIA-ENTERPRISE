import { useEffect, useMemo, useState } from 'react'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import Table, { TableRow, TableCell, TableStateRow } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/form'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/utils/formatters'
import {
  CUSTOMER_SEGMENTS,
  createCustomer,
  deactivateCustomer,
  listCustomers,
  updateCustomer,
} from '../services/customerService'
import type { Customer, CustomerInput } from '@/types/customer'
import CustomerForm from '../components/CustomerForm'
import CustomerHistoryModal from '../components/CustomerHistoryModal'
import { useDataVersion } from '@/data/DataProvider'

/**
 * Página de Clientes (Fase 07 · RF-03): listado con búsqueda y filtros,
 * alta/edición con validación, historial y baja lógica.
 * TODO(Fase 05): conectar con /api/v1/customers.
 */

const PAGE_SIZE = 10

const STATUS_LABELS: Record<Customer['status'], { variant: 'success' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Activo' },
  inactive: { variant: 'neutral', label: 'Inactivo' },
}

export default function CustomersPage() {
  const toast = useToast()

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

  // Diálogos
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const version = useDataVersion()
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
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
          setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los clientes')
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
        toast.success('Cliente actualizado', `${input.name} se guardó correctamente.`)
      } else {
        await createCustomer(input)
        toast.success('Cliente creado', `${input.name} se agregó al directorio.`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error('No se pudo guardar', reason instanceof Error ? reason.message : 'Error inesperado')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deactivateCustomer(deleting.id)
      toast.success('Cliente dado de baja', `${deleting.name} pasó a estado inactivo.`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      toast.error('No se pudo dar de baja', reason instanceof Error ? reason.message : 'Error inesperado')
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Clientes</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Directorio de clientes: fichas, segmentación, historial y estados (RF-03).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre, documento o correo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:flex-1"
        />
        <Select
          aria-label="Filtrar por segmento"
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          className="md:w-44"
        >
          <option value="">Todos los segmentos</option>
          {CUSTOMER_SEGMENTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive' | '')}
          className="md:w-40"
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
      </div>

      {/* Contenido */}
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
      ) : loading && customers.length === 0 ? (
        <div className="card">
          <Table headers={['Cliente', 'Documento', 'Segmento', 'Compras', 'Estado', '']}>
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando clientes…
              </span>
            </TableStateRow>
          </Table>
        </div>
      ) : customers.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Sin clientes"
            description="No hay registros que coincidan con la búsqueda."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo cliente
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Table headers={['Cliente', 'Documento', 'Segmento', 'Compras', 'Estado', 'Acciones']}>
            {visible.map((customer) => {
              const statusLabel = STATUS_LABELS[customer.status]
              return (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-caption text-gray-500">{customer.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-caption text-gray-500">{customer.document_type} </span>
                    <span className="font-mono text-body-sm">{customer.document_number}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">{customer.segment}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{customer.purchase_count} compras</div>
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
                        onClick={() => setHistoryCustomer(customer)}
                        aria-label={`Ver historial de ${customer.name}`}
                        title="Ver historial"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <History aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        aria-label={`Editar ${customer.name}`}
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      {customer.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => setDeleting(customer)}
                          aria-label={`Dar de baja a ${customer.name}`}
                          title="Dar de baja"
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
          </Table>

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            total={customers.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}

      {/* Alta / edición */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
        onSubmit={handleSubmit}
      />

      {/* Historial */}
      <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />

      {/* Confirmación de baja */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Dar de baja cliente"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deletingBusy}>
              Dar de baja
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-600">
          El cliente{' '}
          <span className="font-semibold text-gray-900">{deleting?.name}</span> quedará en estado
          inactivo (baja lógica). Su historial de compras se conserva.
        </p>
      </Modal>
    </div>
  )
}
