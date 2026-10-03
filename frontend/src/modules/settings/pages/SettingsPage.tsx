import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Palette, RotateCcw, Save, Server, UserCog, Users, Database } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Input, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/utils/formatters'
import { ROLES, listManagedUsers } from '@/modules/auth/services/authService'
import type { ManagedUser } from '@/modules/auth/services/authService'
import { useAuth } from '@/hooks/useAuth'
import { getState } from '@/data/store'
import { hydrateStore } from '@/services/hydrate'

/**
 * Configuración del sistema (Fase 06 · RF-02):
 * perfil del usuario, parámetros de operación, usuarios y roles,
 * paleta corporativa y estado de la integración con la API.
 * TODO(Fase 05): los usuarios, roles y auditoría vienen del
 * backend (GET /api/v1/users, /roles y /audit).
 */

const PALETTE = [
  { token: 'primary', hex: '#1E3A8A', uso: 'Azul corporativo' },
  { token: 'accent', hex: '#06B6D4', uso: 'Cyan de acciones' },
  { token: 'success', hex: '#10B981', uso: 'Estados OK' },
  { token: 'warning', hex: '#F59E0B', uso: 'Alertas' },
  { token: 'error', hex: '#EF4444', uso: 'Errores' },
  { token: 'gray-50', hex: '#F9FAFB', uso: 'Fondo de contenido' },
]

export default function SettingsPage() {
  const toast = useToast()
  const { user } = useAuth()

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currency, setCurrency] = useState('PEN')
  const [taxRate, setTaxRate] = useState('18')
  const [pageSize, setPageSize] = useState('10')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingParams, setSavingParams] = useState(false)

  useEffect(() => {
    // GET /api/v1/users (solo Admin) — Fase 05.
    listManagedUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [])

  const handleProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProfile(true)
    try {
      // TODO(Fase 05): PUT /api/v1/users/{id}
      toast.success('Perfil actualizado', 'Los cambios se guardarán en el backend en la Fase 05.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleParams = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingParams(true)
    try {
      // TODO(Fase 05): los parámetros irán en la configuración de la empresa.
      toast.success('Parámetros guardados', 'Moneda, impuesto y paginación actualizados.')
    } finally {
      setSavingParams(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Configuración</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          Perfil, parámetros de operación, usuarios y roles del sistema.
        </p>
      </div>

      {/* Perfil */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Mi perfil</h2>
        </div>
        <form onSubmit={handleProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre completo" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label="Correo electrónico" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <div className="sm:col-span-2">
            <p className="text-body-sm text-gray-600">
              Rol actual: <Badge variant="primary">{user?.role ?? 'Admin'}</Badge>{' '}
              <span className="text-caption text-gray-500">(los roles se gestionan en Fase 13 · RF-02)</span>
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={savingProfile}>
              <Save aria-hidden="true" className="h-4 w-4" />
              Guardar perfil
            </Button>
          </div>
        </form>
      </section>

      {/* Parámetros */}
      <section className="card space-y-4">
        <h2 className="text-h4 text-gray-800">Parámetros de operación</h2>
        <form onSubmit={handleParams} className="grid gap-4 sm:grid-cols-3">
          <Select label="Moneda" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dólares (US$)</option>
          </Select>
          <Input
            label="Tasa de impuesto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            hint="IGV por defecto en las ventas"
          />
          <Select label="Filas por página" value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </Select>
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" loading={savingParams}>
              <Save aria-hidden="true" className="h-4 w-4" />
              Guardar parámetros
            </Button>
          </div>
        </form>
      </section>

      {/* Usuarios y roles */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Usuarios y roles</h2>
        </div>
        <Table headers={['Usuario', 'Correo', 'Rol', 'Estado']}>
          {users.map((managed) => (
            <TableRow key={managed.id}>
              <TableCell className="font-medium text-gray-900">{managed.name}</TableCell>
              <TableCell className="text-gray-600">{managed.email}</TableCell>
              <TableCell>
                <Badge variant="primary">{managed.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={managed.status === 'active' ? 'success' : 'neutral'}>
                  {managed.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </Table>
        <p className="text-caption text-gray-500">
          Roles disponibles: {ROLES.join(' · ')} — la gestión completa de usuarios llega con la Fase 13.
        </p>
      </section>

      {/* Paleta corporativa */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h3 text-gray-800">Paleta corporativa (Fase 03)</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PALETTE.map((color) => (
            <div key={color.token} className="card p-3">
              <div className="mb-2 h-12 rounded-md" style={{ backgroundColor: color.hex }} />
              <p className="text-body-sm font-semibold text-gray-900">{color.token}</p>
              <p className="font-mono text-caption text-gray-500">{color.hex}</p>
              <p className="text-caption text-gray-400">{color.uso}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Datos de demostración */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Database aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Datos de demostración</h2>
        </div>
        <p className="text-body-sm text-gray-600">
          Todos los módulos (Clientes, Productos, Ventas, Inventario, Analytics, Probabilidad,
          Insights, Reportes y Dashboard) leen y escriben sobre el mismo almacén en memoria: al
          registrar una venta se actualizan el stock, el kardex, el historial del cliente y los
          indicadores, y queda registrada la traza del proceso.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              hydrateStore()
                .then(() =>
                  toast.success('Datos sincronizados', 'Se recargaron los datos desde la API.'),
                )
                .catch((reason: unknown) =>
                  toast.error(
                    'No se pudo sincronizar',
                    reason instanceof Error ? reason.message : 'Error inesperado',
                  ),
                )
            }}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Sincronizar con la API
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info(
                'Almacén en memoria',
                `Productos: ${getState().products.length} · Clientes: ${getState().customers.length} · Ventas: ${getState().sales.length} · Movimientos: ${getState().movements.length}`,
              )
            }
          >
            Ver estado del almacén
          </Button>
        </div>
      </section>

      {/* Estado del sistema */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Server aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Estado del sistema</h2>
        </div>
        <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Fase actual</dt>
            <dd className="font-semibold text-gray-900">Fase 06 · Frontend</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">API (backend)</dt>
            <dd>
              <Badge variant="warning">Pendiente · Fase 05</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Base de datos</dt>
            <dd>
              <Badge variant="warning">Pendiente · Fase 04</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Última revisión</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(new Date())}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
