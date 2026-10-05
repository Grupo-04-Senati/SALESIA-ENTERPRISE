import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  Camera,
  Database,
  KeyRound,
  Palette,
  Pencil,
  RotateCcw,
  Save,
  Server,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/form'
import Tabs, { TabPanel } from '@/components/ui/Tabs'
import NotificationsPanel from '../components/NotificationsPanel'
import ExportsPanel from '../components/ExportsPanel'
import ReportsPanel from '../components/ReportsPanel'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatDateTime } from '@/utils/formatters'
import {
  ROLES,
  changePassword,
  createManagedUser,
  listManagedUsers,
  setCurrentUser,
  updateManagedUser,
  updateProfile,
} from '@/modules/auth/services/authService'
import type {
  CreateUserInput,
  ManagedUser,
  ProfileInput,
  UpdateManagedUserInput,
} from '@/modules/auth/services/authService'
import type { Role } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { getState } from '@/data/store'
import { hydrateStore } from '@/services/hydrate'
import { API_BASE } from '@/services/api'
import {
  cleanText,
  email as emailRule,
  hasLetter,
  maxLength,
  minLength,
  numberRange,
  required,
} from '@/utils/validators'

/**
 * Configuración del sistema (RF-02): secciones separadas en pestañas —
 * Perfil, Parámetros, Usuarios y roles (alta de usuarios vía POST /users)
 * y Sistema (paleta, datos y estado de la integración con la API).
 */

const TAB_ITEMS = [
  { id: 'perfil', label: 'settings.mi-perfil' },
  { id: 'parametros', label: 'settings.parametros' },
  { id: 'usuarios', label: 'settings.usuarios-y-roles' },
  { id: 'sistema', label: 'settings.sistema' },
  { id: 'notificaciones', label: 'settings.notificaciones' },
  { id: 'exportaciones', label: 'settings.exportaciones' },
  { id: 'reportes', label: 'settings.reportes' },
]

const EMPTY_USER_FORM: CreateUserInput = {
  full_name: '',
  email: '',
  password: '',
  role: 'Vendedor',
}

const PALETTE = [
  { token: 'primary', hex: '#1E3A8A', uso: 'settings.uso-azul-corporativo' },
  { token: 'accent', hex: '#06B6D4', uso: 'settings.uso-cyan-de-acciones' },
  { token: 'success', hex: '#10B981', uso: 'settings.uso-estados-ok' },
  { token: 'warning', hex: '#F59E0B', uso: 'settings.uso-alertas' },
  { token: 'error', hex: '#EF4444', uso: 'settings.uso-errores' },
  { token: 'gray-50', hex: '#F9FAFB', uso: 'settings.uso-fondo-de-contenido' },
]

const PREFS_KEY = 'salesia_prefs'

interface Prefs {
  currency: string
  taxRate: string
  pageSize: string
}

const DEFAULT_PREFS: Prefs = { currency: 'PEN', taxRate: '18', pageSize: '10' }

/** Reduce la foto a un cuadro de 256 px y devuelve un data-URI JPEG. */
function readAndResizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|avif|gif)$/.test(file.type)) {
      reject(new Error('type'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('decode'))
      image.onload = () => {
        const max = 256
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('canvas'))
          return
        }
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

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
  const { t } = useLang()
  const { user } = useAuth()

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [savingProfile, setSavingProfile] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'up' | 'down'>('checking')
  const [tab, setTab] = useState('perfil')
  const tabs =
    user?.role === 'Admin'
      ? TAB_ITEMS
      : TAB_ITEMS.filter((item) => item.id !== 'usuarios')

  // Alta de usuarios (POST /users, solo Admin).
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [userFormError, setUserFormError] = useState<string | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)

  // Perfil: foto pendiente (null = sin cambios, '' = quitar) y contraseña propia.
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [savingPwd, setSavingPwd] = useState(false)

  // Edición de usuarios (PUT /users/{id}, solo Admin).
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: 'Vendedor' as Role,
    status: 'active' as 'active' | 'inactive',
    password: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Vista previa de la foto (borrador sin guardar o foto guardada) e iniciales.
  const shownAvatar = avatarDraft !== null ? avatarDraft : (user?.avatar ?? null)
  const initials =
    (user?.name ?? 'Usuario')
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'US'

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
            ? `${t('settings.no-se-pudo-cargar-el-listado')} ${reason.message}`
            : t('settings.no-se-pudo-cargar-el-listado-de-usuarios'),
        )
      })
  }

  useEffect(() => {
    // GET /api/v1/users solo lo admite el Admin.
    if (user?.role === 'Admin') loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  useEffect(() => {
    // Estado real del backend (GET /health).
    fetch(`${API_BASE}/health`)
      .then((response) => setApiStatus(response.ok ? 'up' : 'down'))
      .catch(() => setApiStatus('down'))
  }, [])

  const handleProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    const fullName = cleanText(name)
    const nameError =
      minLength(2, t('settings.el-nombre-completo-debe-tener-al-menos-2-caracteres'))(fullName) ??
      maxLength(150)(fullName) ??
      hasLetter()(fullName)
    if (nameError) {
      toast.error(t('settings.no-se-pudo-actualizar'), nameError)
      return
    }
    setSavingProfile(true)
    try {
      const input: ProfileInput = { full_name: fullName }
      if (avatarDraft !== null) input.avatar = avatarDraft
      await updateProfile(input)
      setAvatarDraft(null)
      toast.success(
        t('settings.perfil-actualizado'),
        avatarDraft !== null
          ? t('settings.el-nombre-y-la-foto-se-guardaron')
          : t('settings.el-nombre-de-tu-cuenta-se-guardo-en-el-backend'),
      )
    } catch (reason) {
      toast.error(
        t('settings.no-se-pudo-actualizar'),
        reason instanceof Error ? reason.message : t('settings.error-inesperado'),
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setAvatarDraft(await readAndResizeAvatar(file))
    } catch {
      toast.error(
        t('settings.no-se-pudo-actualizar'),
        t('settings.la-foto-debe-ser-jpg-o-png'),
      )
    }
  }

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPwdError(null)
    const currentError = required()(pwd.current)
    if (currentError) {
      setPwdError(currentError)
      return
    }
    if (pwd.next.length < 6) {
      setPwdError(t('settings.la-contrasena-debe-tener-al-menos-6-caracteres'))
      return
    }
    const nextError = maxLength(72)(pwd.next)
    if (nextError) {
      setPwdError(nextError)
      return
    }
    if (pwd.next !== pwd.confirm) {
      setPwdError(t('settings.las-contrasenas-no-coinciden'))
      return
    }
    if (pwd.next === pwd.current) {
      setPwdError(t('settings.la-nueva-debe-ser-distinta'))
      return
    }
    setSavingPwd(true)
    try {
      await changePassword(pwd.current, pwd.next)
      setPwd({ current: '', next: '', confirm: '' })
      toast.success(
        t('settings.contrasena-actualizada'),
        t('settings.tu-contrasena-cambio-correctamente'),
      )
    } catch (reason) {
      toast.error(
        t('settings.no-se-pudo-cambiar-la-contrasena'),
        reason instanceof Error ? reason.message : t('settings.error-inesperado'),
      )
    } finally {
      setSavingPwd(false)
    }
  }

  const openEdit = (managed: ManagedUser) => {
    setEditTarget(managed)
    setEditForm({
      full_name: managed.name,
      role: (managed.role as Role) ?? 'Vendedor',
      status: managed.status,
      password: '',
    })
    setEditError(null)
  }

  const handleEditUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editTarget || !user) return
    const fullName = cleanText(editForm.full_name)
    const nameError =
      minLength(2, t('settings.el-nombre-completo-debe-tener-al-menos-2-caracteres'))(fullName) ??
      maxLength(150)(fullName) ??
      hasLetter()(fullName)
    if (nameError) {
      setEditError(nameError)
      return
    }
    if (editForm.password && editForm.password.length < 6) {
      setEditError(t('settings.la-contrasena-debe-tener-al-menos-6-caracteres'))
      return
    }
    const editPwdError = editForm.password ? maxLength(72)(editForm.password) : null
    if (editPwdError) {
      setEditError(editPwdError)
      return
    }
    const isSelf = editTarget.id === user.id
    if (isSelf && editForm.role !== user.role) {
      setEditError(t('settings.no-modifiques-tu-propio-rol'))
      return
    }
    setEditError(null)
    setSavingEdit(true)
    try {
      const input: UpdateManagedUserInput = {
        full_name: fullName,
        role: editForm.role,
        status: editForm.status,
      }
      if (editForm.password) input.password = editForm.password
      await updateManagedUser(editTarget.id, input)
      if (isSelf) setCurrentUser({ ...user, name: fullName })
      toast.success(
        t('settings.usuario-actualizado'),
        `${fullName} · ${t('settings.los-cambios-se-guardaron')}`,
      )
      setEditTarget(null)
      loadUsers()
    } catch (reason) {
      setEditError(
        reason instanceof Error ? reason.message : t('settings.no-se-pudo-actualizar'),
      )
    } finally {
      setSavingEdit(false)
    }
  }

  const handleParams = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const taxError = required()(prefs.taxRate) ?? numberRange(0, 100)(prefs.taxRate)
    if (taxError) {
      toast.error(t('settings.tasa-de-impuesto'), taxError)
      return
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    toast.success(
      t('settings.preferencias-guardadas'),
      t('settings.moneda-impuesto-y-paginacion-se-aplican-en-este-navegador'),
    )
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fullName = cleanText(userForm.full_name)
    const email = userForm.email.trim().toLowerCase()
    const nameError =
      minLength(2, t('settings.el-nombre-completo-debe-tener-al-menos-2-caracteres'))(fullName) ??
      maxLength(150)(fullName) ??
      hasLetter()(fullName)
    if (nameError) {
      setUserFormError(nameError)
      return
    }
    const emailError = emailRule(t('settings.ingresa-un-correo-electronico-valido'))(email)
    if (emailError) {
      setUserFormError(emailError)
      return
    }
    const emailMaxLengthError = maxLength(160)(email)
    if (emailMaxLengthError) {
      setUserFormError(emailMaxLengthError)
      return
    }
    if (userForm.password.length < 6) {
      setUserFormError(t('settings.la-contrasena-debe-tener-al-menos-6-caracteres'))
      return
    }
    const passwordError = maxLength(72)(userForm.password)
    if (passwordError) {
      setUserFormError(passwordError)
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
      toast.success(
        t('settings.usuario-creado'),
        `${created.name} ${t('settings.ya-puede-iniciar-sesion-con')} ${created.email}.`,
      )
      setUserModalOpen(false)
      setUserForm(EMPTY_USER_FORM)
      loadUsers()
    } catch (reason) {
      setUserFormError(
        reason instanceof Error ? reason.message : t('settings.no-se-pudo-crear-el-usuario'),
      )
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('settings.configuracion')}</h1>
        <p className="mt-1 text-body-sm text-gray-600">
          {t('settings.perfil-parametros-de-operacion')}
        </p>
      </div>

      <Tabs
        items={tabs.map((item) => ({ ...item, label: t(item.label) }))}
        value={tab}
        onChange={setTab}
        id="configuracion"
      />

      {/* Perfil */}
      <TabPanel tabId="perfil" active={tab === 'perfil'}>
      <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">{t('settings.mi-perfil')}</h2>
        </div>
        <form onSubmit={handleProfile} className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-h4 font-semibold text-white">
              {shownAvatar ? (
                <img
                  src={shownAvatar}
                  alt={t('settings.foto-de-perfil')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-body-sm font-semibold text-gray-800">
                {t('settings.foto-de-perfil')}
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Camera aria-hidden="true" className="h-4 w-4" />
                  {t('settings.cambiar-foto')}
                </Button>
                {shownAvatar && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAvatarDraft('')}
                  >
                    {t('settings.quitar-foto')}
                  </Button>
                )}
              </div>
              <p className="text-caption text-gray-500">
                {t('settings.la-foto-debe-ser-jpg-o-png')}
              </p>
            </div>
          </div>
          <Input
            label={t('settings.nombre-completo')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={150}
          />
          <Input
            label={t('settings.correo-electronico')}
            type="email"
            value={user?.email ?? ''}
            disabled
            hint={t('settings.el-correo-de-acceso-no-se-puede-modificar')}
          />
          <div className="sm:col-span-2">
            <p className="text-body-sm text-gray-600">
              {t('settings.rol-actual')} <Badge variant="primary">{user?.role ?? 'Admin'}</Badge>{' '}
              <span className="text-caption text-gray-500">{t('settings.se-crean-en-la-pestana')}</span>
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={savingProfile}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {t('settings.guardar-perfil')}
            </Button>
          </div>
        </form>
      </section>

      {/* Contraseña propia (cualquier rol) */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">{t('settings.cambiar-contrasena')}</h2>
        </div>
        <form onSubmit={handlePassword} className="grid gap-4 sm:grid-cols-3">
          <Input
            label={t('settings.contrasena-actual')}
            type="password"
            required
            autoComplete="current-password"
            value={pwd.current}
            onChange={(event) => setPwd({ ...pwd, current: event.target.value })}
          />
          <Input
            label={t('settings.contrasena-nueva')}
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            value={pwd.next}
            onChange={(event) => setPwd({ ...pwd, next: event.target.value })}
            hint={t('settings.minimo-6-caracteres')}
          />
          <Input
            label={t('settings.repetir-contrasena')}
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            value={pwd.confirm}
            onChange={(event) => setPwd({ ...pwd, confirm: event.target.value })}
          />
          {pwdError && (
            <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-caption text-error sm:col-span-3">
              {pwdError}
            </p>
          )}
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" loading={savingPwd}>
              <KeyRound aria-hidden="true" className="h-4 w-4" />
              {t('settings.cambiar-contrasena')}
            </Button>
          </div>
        </form>
      </section>
      </div>
      </TabPanel>

      {/* Parámetros */}
      <TabPanel tabId="parametros" active={tab === 'parametros'}>
      <section className="card space-y-4">
        <h2 className="text-h4 text-gray-800">{t('settings.parametros-de-operacion')}</h2>
        <form onSubmit={handleParams} className="grid gap-4 sm:grid-cols-3">
          <Select
            label={t('settings.moneda')}
            value={prefs.currency}
            onChange={(event) => setPrefs((prev) => ({ ...prev, currency: event.target.value }))}
          >
            <option value="PEN">{t('settings.soles')}</option>
            <option value="USD">{t('settings.dolares')}</option>
          </Select>
          <Input
            label={t('settings.tasa-de-impuesto')}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={prefs.taxRate}
            onChange={(event) => setPrefs((prev) => ({ ...prev, taxRate: event.target.value }))}
            hint={t('settings.igv-por-defecto-en-las-ventas')}
          />
          <Select
            label={t('settings.filas-por-pagina')}
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
              {t('settings.guardar-parametros')}
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
            <h2 className="text-h3 text-gray-800">{t('settings.usuarios-y-roles')}</h2>
          </div>
          <Button
            onClick={() => {
              setUserForm(EMPTY_USER_FORM)
              setUserFormError(null)
              setUserModalOpen(true)
            }}
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            {t('settings.nuevo-usuario')}
          </Button>
        </div>

        {usersError ? (
          <div className="card">
            <EmptyState
              title={t('settings.sin-acceso-al-listado')}
              description={usersError}
            />
          </div>
        ) : users.length === 0 ? (
          <div className="card">
            <EmptyState
              title={t('settings.sin-usuarios')}
              description={t('settings.aun-no-hay-usuarios-en-la-lista')}
            />
          </div>
        ) : (
          <DataTable
            headers={[
              t('settings.usuario'),
              t('settings.correo'),
              t('settings.rol'),
              t('settings.estado'),
              t('settings.acciones'),
            ]}
          >
            {users.map((managed) => (
              <TableRow key={managed.id}>
                <TableCell className="font-medium text-gray-900">{managed.name}</TableCell>
                <TableCell className="text-gray-600">{managed.email}</TableCell>
                <TableCell>
                  <Badge variant="primary">{managed.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={managed.status === 'active' ? 'success' : 'neutral'}>
                    {managed.status === 'active' ? t('settings.activo') : t('settings.inactivo')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => openEdit(managed)}>
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    {t('settings.editar')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
        <p className="text-caption text-gray-500">
          {t('settings.administra-nombre-rol-estado')} — {t('settings.roles-disponibles')}{' '}
          {ROLES.join(' · ')}
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
          <h2 className="text-h3 text-gray-800">{t('settings.paleta-corporativa-fase-03')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PALETTE.map((color) => (
            <div key={color.token} className="card p-3">
              <div className="mb-2 h-12 rounded-md" style={{ backgroundColor: color.hex }} />
              <p className="text-body-sm font-semibold text-gray-900">{color.token}</p>
              <p className="font-mono text-caption text-gray-500">{color.hex}</p>
              <p className="text-caption text-gray-400">{t(color.uso)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Datos del sistema */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Database aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">{t('settings.datos-del-sistema')}</h2>
        </div>
        <p className="text-body-sm text-gray-600">
          {t('settings.todos-los-modulos-leen-y-escriben-sobre-el-mismo-almacen')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              hydrateStore()
                .then(() =>
                  toast.success(
                    t('settings.datos-sincronizados'),
                    t('settings.se-recargaron-los-datos-desde-la-api'),
                  ),
                )
                .catch((reason: unknown) =>
                  toast.error(
                    t('settings.no-se-pudo-sincronizar'),
                    reason instanceof Error ? reason.message : t('settings.error-inesperado'),
                  ),
                )
            }}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {t('settings.sincronizar-con-la-api')}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info(
                t('settings.almacen-en-memoria'),
                `${t('settings.productos')}: ${getState().products.length} · ${t('settings.clientes')}: ${getState().customers.length} · ${t('settings.ventas')}: ${getState().sales.length} · ${t('settings.movimientos')}: ${getState().movements.length}`,
              )
            }
          >
            {t('settings.ver-estado-del-almacen')}
          </Button>
        </div>
      </section>

      {/* Estado del sistema */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Server aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-h4 text-gray-800">{t('settings.estado-del-sistema')}</h2>
        </div>
        <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">{t('settings.api-backend')}</dt>
            <dd>
              {apiStatus === 'checking' && (
                <Badge variant="neutral">{t('settings.comprobando')}</Badge>
              )}
              {apiStatus === 'up' && <Badge variant="success">{t('settings.operativa')}</Badge>}
              {apiStatus === 'down' && <Badge variant="error">{t('settings.sin-conexion')}</Badge>}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">{t('settings.base-de-datos')}</dt>
            <dd>
              <Badge variant="primary">Supabase · PostgreSQL</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">{t('settings.almacen-local')}</dt>
            <dd>
              <Badge variant="success">{t('settings.hidratado-desde-la-api')}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <dt className="text-gray-600">{t('settings.ultima-revision')}</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(new Date())}</dd>
          </div>
        </dl>
      </section>
      </div>
      </TabPanel>

      {/* Notificaciones */}
      <TabPanel tabId="notificaciones" active={tab === 'notificaciones'}>
        <NotificationsPanel />
      </TabPanel>

      {/* Exportaciones */}
      <TabPanel tabId="exportaciones" active={tab === 'exportaciones'}>
        <ExportsPanel />
      </TabPanel>

      {/* Reportes programados */}
      <TabPanel tabId="reportes" active={tab === 'reportes'}>
        <ReportsPanel />
      </TabPanel>

      {/* Alta de usuarios (POST /users · RF-02) */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={t('settings.nuevo-usuario')}
        footer={
          <>
            <Button variant="outline" onClick={() => setUserModalOpen(false)}>
              {t('settings.cancelar')}
            </Button>
            <Button type="submit" form="user-form" loading={creatingUser}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              {t('settings.crear-usuario')}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label={t('settings.nombre-completo')}
            required
            minLength={2}
            maxLength={150}
            value={userForm.full_name}
            onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })}
            placeholder={t('settings.ej-ana-torres')}
          />
          <Input
            label={t('settings.correo-electronico')}
            type="email"
            required
            autoComplete="off"
            maxLength={160}
            value={userForm.email}
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
            placeholder="ana.torres@salesia.com"
            hint={t('settings.sera-su-usuario-de-acceso')}
          />
          <Input
            label={t('settings.contrasena-inicial')}
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete="new-password"
            value={userForm.password}
            onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
            hint={t('settings.minimo-6-caracteres')}
          />
          <Select
            label={t('settings.rol')}
            required
            value={userForm.role}
            onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}
            hint={t('settings.define-los-permisos-del-usuario-en-el-sistema')}
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

      {/* Edición de usuarios (PUT /users/{id} · nombre, rol, estado y contraseña) */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={t('settings.editar-usuario')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              {t('settings.cancelar')}
            </Button>
            <Button type="submit" form="edit-user-form" loading={savingEdit}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {t('settings.guardar-cambios')}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditUser} className="space-y-4">
          <Input
            label={t('settings.nombre-completo')}
            required
            minLength={2}
            maxLength={150}
            value={editForm.full_name}
            onChange={(event) => setEditForm({ ...editForm, full_name: event.target.value })}
          />
          <Input
            label={t('settings.correo-electronico')}
            type="email"
            value={editTarget?.email ?? ''}
            disabled
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('settings.rol')}
              value={editForm.role}
              onChange={(event) =>
                setEditForm({ ...editForm, role: event.target.value as Role })
              }
              disabled={editTarget?.id === user?.id}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <Select
              label={t('settings.estado')}
              value={editForm.status}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  status: event.target.value as 'active' | 'inactive',
                })
              }
              disabled={editTarget?.id === user?.id}
            >
              <option value="active">{t('settings.activo')}</option>
              <option value="inactive">{t('settings.inactivo')}</option>
            </Select>
          </div>
          <Input
            label={t('settings.contrasena-nueva')}
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={72}
            value={editForm.password}
            onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
            hint={t('settings.deja-la-contrasena-vacia-para-no-cambiarla')}
          />
          {editError && (
            <p role="alert" className="rounded-md bg-error/10 px-3 py-2 text-caption text-error">
              {editError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
