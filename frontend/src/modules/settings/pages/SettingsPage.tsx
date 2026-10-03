import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Palette, RotateCcw, Save, Server, UserCog, UserPlus, Users, Database } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/utils/formatters'
import {
  ROLES,
  createManagedUser,
  listManagedUsers,
  updateProfileName,
} from '@/modules/auth/services/authService'
import type { CreateUserInput, ManagedUser } from '@/modules/auth/services/authService'
import type { Role } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { getState } from '@/data/store'
import { hydrateStore } from '@/services/hydrate'
import { API_BASE } from '@/services/api'

/**
 * Configuración del sistema (RF-02): secciones separadas en pestañas —
 * Perfil, Parámetros, Usuarios y roles (alta de usuarios vía POST /users)
 * y Sistema (paleta, datos y estado de la integración con la API).
 */

const TAB_ITEMS = [
  { id: 'perfil', label: 'Mi perfil' },
  { id: 'parametros', label: 'Parámetros' },
  { id: 'usuarios', label: 'Usuarios y roles' },
  { id: 'sistema', label: 'Sistema' },
]

const EMPTY_USER_FORM: CreateUserInput = {
  full_name: '',
  email: '',
  password: '',
  role: 'Vendedor',
}

const PALETTE = [
  { token: 'primary', hex: '#1E3A8A', uso: 'Azul corporativo' },
  { token: 'accent', hex: '#06B6D4', uso: 'Cyan de acciones' },
  { token: 'success', hex: '#10B981', uso: 'Estados OK' },
  { token: 'warning', hex: '#F59E0B', uso: 'Alertas' },
  { token: 'error', hex: '#EF4444', uso: 'Errores' },
  { token: 'gray-50', hex: '#F9FAFB', uso: 'Fondo de contenido' },
]

const PREFS_KEY = 'salesia_prefs'

interface Prefs {
  currency: string
  taxRate: string
  pageSize: string
}

const DEFAULT_PREFS: Prefs = { currency: 'PEN', taxRate: '18', pageSize: '10' }

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    // Si las preferencias están corruptas se usan los valores por defecto.
  }
  return DEFAULT_PREFS
}

export default function SettingsPage() {
  const toast = useToast()
  const { user } = useAuth()

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [savingProfile, setSavingProfile] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'up' | 'down'>('checking')
  const [tab, setTab] = useState('perfil')

  // Alta de usuarios (POST /users, solo Admin).
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [userFormError, setUserFormError] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)

  const loadUsers = () => {
    // GET /api/v1/users (solo Admin).
    listManagedUsers()
      .then((items) => {
        setUsers(items)
        setUsersError(null)
      })
      .catch((reason: unknown) => {
        setUsers([])
        setUsersError(
          reason instanceof Error
            ? `No se pudo cargar el listado: ${reason.message}`
            : 'No se pudo cargar el listado de usuarios.',
        )
      })
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    // Estado real del backend (GET /health).
    fetch(`${API_BASE}/health`)
      .then((response) => setApiStatus(response.ok ? 'up' : 'down'))
      .catch(() => setApiStatus('down'))
  }, [])

  const handleProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setSavingProfile(true)
    try {
      await updateProfileName(user.id, name.trim())
      toast.success('Perfil actualizado', 'El nombre de tu cuenta se guardó en el backend.')
    } catch (reason) {
      toast.error(
        'No se pudo actualizar',
        reason instanceof Error ? reason.message : 'Error inesperado',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleParams = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    toast.success(
      'Preferencias guardadas',
      'Moneda, impuesto y paginación se aplican en este navegador.',
    )
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fullName = userForm.full_name.trim()
    const email = userForm.email.trim().toLowerCase()
    if (fullName.length < 2) {
      setUserFormError('El nombre completo debe tener al menos 2 caracteres.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setUserFormError('Ingresa un correo electrónico válido.')
      return
    }
    if (userForm.password.length < 6) {
      setUserFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setUserFormError(null)
    setCreatingUser(true)
    try {
      const created = await createManagedUser({
        full_name: fullName,
        email,
        password: userForm.password,
        role: userForm.role,
      })
      toast.success('Usuario creado', `${created.name} ya puede iniciar sesión con ${created.email}.`)
      setUserModalOpen(false)
      setUserForm(EMPTY_USER_FORM)
      loadUsers()
    } catch (reason) {
      setUserFormError(reason instanceof Error ? reason.message : 'No se pudo crear el usuario.')
    } finally {
      setCreatingUser(false)
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

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} id="configuracion" />

      {/* Perfil */}
      <TabPanel tabId="perfil" active={tab === 'perfil'}>
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Mi perfil</h2>
        </div>
        <form onSubmit={handleProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre completo" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input
            label="Correo electrónico"
            type="email"
            value={user?.email ?? ''}
            disabled
            hint="El correo de acceso no se puede modificar"
          />
          <div className="sm:col-span-2">
            <p className="text-body-sm text-gray-600">
              Rol actual: <Badge variant="primary">{user?.role ?? 'Admin'}</Badge>{' '}
              <span className="text-caption text-gray-500">(se crean en la pestaña «Usuarios y roles» · RF-02)</span>
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
      </TabPanel>

      {/* Parámetros */}
      <TabPanel tabId="parametros" active={tab === 'parametros'}>
      <section className="card space-y-4">
        <h2 className="text-h4 text-gray-800">Parámetros de operación</h2>
        <form onSubmit={handleParams} className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Moneda"
            value={prefs.currency}
            onChange={(event) => setPrefs((prev) => ({ ...prev, currency: event.target.value }))}
          >
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dólares (US$)</option>
          </Select>
          <Input
            label="Tasa de impuesto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={prefs.taxRate}
            onChange={(event) => setPrefs((prev) => ({ ...prev, taxRate: event.target.value }))}
            hint="IGV por defecto en las ventas"
          />
          <Select
            label="Filas por página"
            value={prefs.pageSize}
            onChange={(event) => setPrefs((prev) => ({ ...prev, pageSize: event.target.value }))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </Select>
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary">
              <Save aria-hidden="true" className="h-4 w-4" />
              Guardar parámetros
            </Button>
          </div>
        </form>
      </section>
      </TabPanel>

      {/* Usuarios y roles */}
      <TabPanel tabId="usuarios" active={tab === 'usuarios'}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 className="text-h3 text-gray-800">Usuarios y roles</h2>
          </div>
          <Button
            onClick={() => {
              setUserForm(EMPTY_USER_FORM)
              setUserFormError(null)
              setUserModalOpen(true)
            }}
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>

        {usersError ? (
          <div className="card">
            <EmptyState
              title="Sin acceso al listado"
              description={usersError}
            />
          </div>
        ) : users.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Sin usuarios"
              description="Aún no hay usuarios en la lista. Crea el primero con el botón «Nuevo usuario»."
            />
          </div>
        ) : (
          <DataTable headers={['Usuario', 'Correo', 'Rol', 'Estado']}>
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
          </DataTable>
        )}
        <p className="text-caption text-gray-500">
          Roles disponibles: {ROLES.join(' · ')} — la contraseña inicial la defines al crear el
          usuario y él podrá cambiarla después.
        </p>
      </section>
      </TabPanel>

      {/* Sistema: paleta, datos y estado */}
      <TabPanel tabId="sistema" active={tab === 'sistema'}>
      <div className="space-y-6">
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

      {/* Datos del sistema */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Database aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">Datos del sistema</h2>
        </div>
        <p className="text-body-sm text-gray-600">
          Todos los módulos (Clientes, Productos, Ventas, Inventario, Analytics, Probabilidad,
          Insights, Reportes y Dashboard) leen y escriben sobre el mismo almacén: se carga desde la
          API al iniciar sesión y con cada registro nuevo, de modo que el stock, el kardex, el
          historial del cliente y los indicadores quedan actualizados con tus datos.
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
            <dt className="text-gray-600">API (backend)</dt>
            <dd>
              {apiStatus === 'checking' && <Badge variant="neutral">Comprobando…</Badge>}
              {apiStatus === 'up' && <Badge variant="success">Operativa</Badge>}
              {apiStatus === 'down' && <Badge variant="error">Sin conexión</Badge>}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Base de datos</dt>
            <dd>
              <Badge variant="primary">Supabase · PostgreSQL</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Almacén local</dt>
            <dd>
              <Badge variant="success">Hidratado desde la API</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">Última revisión</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(new Date())}</dd>
          </div>
        </dl>
      </section>
      </div>
      </TabPanel>

      {/* Alta de usuarios (POST /users · RF-02) */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Nuevo usuario"
        footer={
          <>
            <Button variant="outline" onClick={() => setUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" loading={creatingUser}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Crear usuario
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Nombre completo"
            required
            minLength={2}
            maxLength={150}
            value={userForm.full_name}
            onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })}
            placeholder="Ej. Ana Torres"
          />
          <Input
            label="Correo electrónico"
            type="email"
            required
            autoComplete="off"
            value={userForm.email}
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
            placeholder="ana.torres@salesia.com"
            hint="Será su usuario de acceso"
          />
          <Input
            label="Contraseña inicial"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={userForm.password}
            onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
            hint="Mínimo 6 caracteres; él podrá cambiarla después"
          />
          <Select
            label="Rol"
            required
            value={userForm.role}
            onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}
            hint="Define los permisos del usuario en el sistema"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          {userFormError && (
            <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-caption text-error">
              {userFormError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
