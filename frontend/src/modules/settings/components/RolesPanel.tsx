import { useEffect, useState } from 'react'
import { Check, Lock, RotateCcw, Save, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import {
  listRoles,
  updateRolePermissions,
  type RoleRecord,
} from '@/modules/auth/services/authService'
import {
  ALL_MODULES,
  GROUP_LABELS,
  GROUP_LABELS_EN,
  MODULE_SUBMODULES,
  NAV_ITEMS,
  ROLE_MODULES,
  ROLE_SUBMODULES,
  type NavItem,
} from '@/utils/constants'

/**
 * Editor de permisos por rol (Configuración → Roles, solo Admin).
 * Marca los módulos (paths de NAV_ITEMS) y, dentro de los que tienen
 * pestañas, sus submódulos. El Admin conserva acceso total bloqueado;
 * el resto guarda la matriz en Role.permissions (PUT /roles/{id}/permissions)
 * y la consume el frontend desde /auth/me.
 */

interface Draft {
  modules: Set<string>
  submodules: Record<string, Set<string>>
}

function modulesOf(role: RoleRecord): string[] {
  if (Array.isArray(role.permissions?.modules)) return role.permissions.modules as string[]
  const fallback = ROLE_MODULES[role.name]
  if (fallback === undefined || fallback === ALL_MODULES) return NAV_ITEMS.map((item) => item.path)
  return fallback
}

function draftOf(role: RoleRecord): Draft {
  const stored = role.permissions?.submodules
  const source = stored ?? ROLE_SUBMODULES[role.name] ?? {}
  const submodules: Record<string, Set<string>> = {}
  for (const [path, subs] of Object.entries(source)) {
    submodules[path] = new Set(subs)
  }
  return { modules: new Set(modulesOf(role)), submodules }
}

function payloadOf(draft: Draft): { modules: string[]; submodules: Record<string, string[]> } {
  const order = NAV_ITEMS.map((item) => item.path)
  const modules = order.filter((path) => draft.modules.has(path))
  const submodules: Record<string, string[]> = {}
  for (const [path, subs] of Object.entries(draft.submodules)) {
    if (subs.size > 0 && draft.modules.has(path)) submodules[path] = [...subs]
  }
  return { modules, submodules }
}

const GROUP_ORDER: NavItem['group'][] = ['operacion', 'analitica', 'sistema']

export default function RolesPanel() {
  const { t, lang } = useLang()
  const toast = useToast()

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    listRoles()
      .then((items) => {
        setRoles(items)
        setError(null)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t('settings.roles-no-se-pudo-cargar'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (role: RoleRecord) => {
    setEditingId(role.id)
    setDraft(draftOf(role))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }

  const toggleModule = (path: string, checked: boolean) => {
    setDraft((current) => {
      if (!current) return current
      const modules = new Set(current.modules)
      const submodules = { ...current.submodules }
      if (checked) {
        modules.add(path)
      } else {
        modules.delete(path)
        delete submodules[path]
      }
      return { modules, submodules }
    })
  }

  const toggleSubmodule = (path: string, sub: string, checked: boolean) => {
    setDraft((current) => {
      if (!current) return current
      // undefined/ vacío = "todos los submódulos del módulo permitidos".
      const existing = current.submodules[path]
      const subs =
        !existing || existing.size === 0
          ? new Set((MODULE_SUBMODULES[path] ?? []).map((def) => def.id))
          : new Set(existing)
      if (checked) subs.add(sub)
      else subs.delete(sub)
      return { ...current, submodules: { ...current.submodules, [path]: subs } }
    })
  }

  const resetDefaults = (role: RoleRecord) => {
    const fallback = ROLE_MODULES[role.name]
    const paths =
      fallback === undefined || fallback === ALL_MODULES
        ? NAV_ITEMS.map((item) => item.path)
        : fallback
    setDraft({ modules: new Set(paths), submodules: {} })
  }

  const save = async (role: RoleRecord) => {
    if (!draft) return
    const payload = payloadOf(draft)
    if (payload.modules.length === 0) {
      toast.error(t('settings.roles-sin-modulos'), t('settings.roles-marca-al-menos-un-modulo'))
      return
    }
    setSaving(true)
    try {
      await updateRolePermissions(role.id, payload.modules, payload.submodules)
      toast.success(
        t('settings.roles-permisos-guardados'),
        `${role.name} · ${payload.modules.length} ${t('settings.roles-modulos')}`,
      )
      cancelEdit()
      load()
    } catch (reason: unknown) {
      toast.error(
        t('settings.roles-no-se-pudo-guardar'),
        reason instanceof Error ? reason.message : undefined,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="card">
        <span className="inline-flex items-center gap-2 text-body-sm text-gray-500">
          <Spinner size={16} className="text-loading" />
          {t('settings.roles-cargando')}
        </span>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card">
        <ErrorState
          description={error}
          action={
            <Button variant="outline" onClick={load}>
              {t('settings.reintentar')}
            </Button>
          }
        />
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="flex items-center gap-2 text-h4 text-gray-800">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" />
          {t('settings.roles-matriz-de-permisos')}
        </h2>
        <p className="text-body-sm text-gray-600">{t('settings.roles-explicacion')}</p>
      </section>

      {roles.map((role) => {
        const isFull = ROLE_MODULES[role.name] === ALL_MODULES
        const isEditing = editingId === role.id
        const count = isFull ? NAV_ITEMS.length : modulesOf(role).length

        return (
          <section key={role.id} className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isFull ? (
                    <Lock aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    {isFull && <Badge variant="primary">{t('settings.roles-acceso-total')}</Badge>}
                    {!isEditing && !isFull && (
                      <Badge variant="neutral">
                        {count} {t('settings.roles-modulos')}
                      </Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-caption text-gray-500">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isFull ? (
                  <span className="inline-flex items-center gap-1.5 text-caption text-gray-500">
                    <Check aria-hidden="true" className="h-4 w-4" />
                    {t('settings.roles-solo-lectura')}
                  </span>
                ) : isEditing ? (
                  <>
                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                      <X aria-hidden="true" className="h-4 w-4" />
                      {t('settings.cancelar')}
                    </Button>
                    <Button size="sm" onClick={() => void save(role)} loading={saving}>
                      <Save aria-hidden="true" className="h-4 w-4" />
                      {t('settings.guardar-cambios')}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => startEdit(role)}>
                    <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                    {t('settings.roles-editar')}
                  </Button>
                )}
              </div>
            </div>

            {isEditing && draft && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-caption text-gray-500">{t('settings.roles-elige-modulos')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetDefaults(role)}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    {t('settings.roles-restaurar')}
                  </Button>
                </div>

                {GROUP_ORDER.map((group) => {
                  const items = NAV_ITEMS.filter((item) => item.group === group)
                  if (items.length === 0) return null
                  return (
                    <div key={group} className="space-y-2">
                      <h4 className="text-caption font-semibold uppercase tracking-wide text-gray-500">
                        {lang === 'en' ? GROUP_LABELS_EN[group] : GROUP_LABELS[group]}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => {
                          const checked = draft.modules.has(item.path)
                          const subs = MODULE_SUBMODULES[item.path]
                          return (
                            <div
                              key={item.path}
                              className={`rounded-lg border p-3 ${
                                checked ? 'border-primary/30 bg-primary/5' : 'border-gray-200'
                              }`}
                            >
                              <Checkbox
                                label={lang === 'en' ? item.labelEn : item.label}
                                checked={checked}
                                onChange={(event) => toggleModule(item.path, event.target.checked)}
                              />
                              {checked && subs && (
                                <div className="mt-2 space-y-1.5 border-t border-primary/10 pt-2 pl-1">
                                  {subs.map((sub) => (
                                    <Checkbox
                                      key={sub.id}
                                      className="text-caption"
                                      label={lang === 'en' ? sub.labelEn : sub.label}
                                      checked={(draft.submodules[item.path]?.size ?? 0) === 0 ||
                                        draft.submodules[item.path]?.has(sub.id) === true}
                                      onChange={(event) =>
                                        toggleSubmodule(item.path, sub.id, event.target.checked)
                                      }
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
