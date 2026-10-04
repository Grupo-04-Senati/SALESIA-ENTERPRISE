import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, UserPlus } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { useDataVersion } from '@/data/DataProvider'
import { formatCurrency } from '@/utils/formatters'
import {
  createEmployee,
  listEmployees,
  toEmployeeInput,
  updateEmployee,
} from '../services/employeeService'
import type { Employee } from '@/types/employee'

/**
 * Página de Vendedores (RF-05 · docs/05 §2.5).
 * Alta y edición de empleados: son quienes pueden vender, así que es el
 * requisito previo para registrar ventas.
 */

const EMPTY_FORM = {
  full_name: '',
  document: '',
  position: 'Vendedor',
  phone: '',
  email: '',
  hire_date: '',
}

export default function EmployeesPage() {
  const toast = useToast()
  const { t } = useLang()
  const version = useDataVersion()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listEmployees()
      .then((result) => {
        if (!cancelled) setEmployees(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : t('employees.no-se-pudieron-cargar-los-vendedores'),
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees.filter(
      (employee) =>
        term === '' ||
        employee.full_name.toLowerCase().includes(term) ||
        (employee.document ?? '').includes(term) ||
        employee.email.toLowerCase().includes(term),
    )
  }, [employees, search])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (employee: Employee) => {
    setEditing(employee)
    setForm({
      full_name: employee.full_name,
      document: employee.document ?? '',
      position: employee.position,
      phone: employee.phone,
      email: employee.email,
      hire_date: employee.hire_date ?? '',
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (form.full_name.trim().length < 2) {
      setFormError(t('employees.el-nombre-debe-tener-al-menos-2-caracteres'))
      return
    }
    const input = toEmployeeInput(form)
    setSaving(true)
    try {
      if (editing) {
        await updateEmployee(editing.id, input)
        toast.success(
          t('employees.vendedor-actualizado'),
          `${input.full_name} ${t('employees.se-guardo-correctamente')}`,
        )
      } else {
        await createEmployee(input)
        toast.success(
          t('employees.vendedor-creado'),
          `${input.full_name} ${t('employees.ya-puede-registrar-ventas')}`,
        )
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(
        reason instanceof Error ? reason.message : t('employees.no-se-pudo-guardar-el-vendedor'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>{t('employees.vendedores')}</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            {t('employees.equipo-comercial-rf-05-crea-aqui-a-quienes-registraran-las-ventas-de-tu-proyecto')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('employees.nuevo-vendedor')}
        </Button>
      </div>

      <div className="card">
        <Input
          type="search"
          aria-label={t('employees.buscar-vendedores')}
          placeholder={t('employees.buscar-por-nombre-documento-o-correo')}
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
                {t('employees.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && employees.length === 0 ? (
        <div className="card">
          <DataTable
            headers={[
              t('employees.vendedor'),
              t('employees.documento'),
              t('employees.cargo'),
              t('employees.contacto'),
              t('employees.ventas'),
              '',
            ]}
          >
            <TableStateRow colSpan={6}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('employees.cargando-vendedores')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserPlus}
            title={t('employees.sin-vendedores')}
            description={t(
              'employees.todavia-no-hay-vendedores-registrados-crea-el-primero-para-poder-registrar-ventas',
            )}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('employees.nuevo-vendedor')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable
            headers={[
              t('employees.vendedor'),
              t('employees.documento'),
              t('employees.cargo'),
              t('employees.contacto'),
              t('employees.ventas'),
              t('employees.acciones'),
            ]}
          >
            {visible.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="font-medium text-gray-900">{employee.full_name}</div>
                  <div className="text-caption text-gray-500">{employee.position}</div>
                </TableCell>
                <TableCell className="font-mono text-body-sm">{employee.document ?? '—'}</TableCell>
                <TableCell className="text-gray-600">{employee.position}</TableCell>
                <TableCell>
                  <div className="text-body-sm text-gray-600">{employee.email || '—'}</div>
                  <div className="text-caption text-gray-500">{employee.phone || '—'}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {t('employees.n-ventas', { n: employee.metrics?.sales ?? 0 })}
                  </div>
                  <div className="text-caption text-gray-500">
                    {formatCurrency(employee.metrics?.revenue ?? 0)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(employee)}
                      aria-label={`${t('employees.editar')} ${employee.full_name}`}
                      title={t('employees.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('employees.editar-vendedor') : t('employees.nuevo-vendedor')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('employees.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('employees.guardar-cambios') : t('employees.crear-vendedor')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('employees.nombre-completo')}
            required
            className="sm:col-span-2"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder={t('employees.ej-juan-perez')}
            error={formError ?? undefined}
            autoFocus
          />
          <Input
            label={t('employees.documento')}
            value={form.document}
            onChange={(event) => setForm({ ...form, document: event.target.value })}
            placeholder={t('employees.dni')}
          />
          <Input
            label={t('employees.cargo')}
            value={form.position}
            onChange={(event) => setForm({ ...form, position: event.target.value })}
            placeholder={t('employees.vendedor')}
          />
          <Input
            label={t('employees.correo')}
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder={t('employees.correo-empresa-com')}
          />
          <Input
            label={t('employees.telefono')}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder={t('employees.telefono-ejemplo')}
          />
          <Input
            label={t('employees.fecha-de-ingreso')}
            type="date"
            className="sm:col-span-2"
            value={form.hire_date}
            onChange={(event) => setForm({ ...form, hire_date: event.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}
