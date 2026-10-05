import { useEffect, useState } from 'react'
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import DataTable, { TableRow, TableCell, TableStateRow } from '@/components/tables/DataTable'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { cleanText, code, hasLetter, maxLength } from '@/utils/validators'
import {
  createSavedRule,
  deleteSavedRule,
  listSavedRules,
  updateSavedRule,
} from '../services/ruleService'
import type { RuleSeverity, SavedRule, SavedRuleInput } from '../services/ruleService'

/** Pestaña «Guardadas» de Automatizaciones (ENDPOINTS.automationRules). */

const SEVERITIES: RuleSeverity[] = ['info', 'warning', 'critical']

const SEVERITY_BADGES: Record<RuleSeverity, BadgeVariant> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

const SEVERITY_KEYS: Record<RuleSeverity, string> = {
  info: 'automation.severidad-informativa',
  warning: 'automation.severidad-advertencia',
  critical: 'automation.severidad-critica',
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  severity: 'info' as RuleSeverity,
  condition: '',
  action: '',
}

export default function SavedRulesPanel() {
  const toast = useToast()
  const { t } = useLang()

  const [rules, setRules] = useState<SavedRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavedRule | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [conditionError, setConditionError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<SavedRule | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSavedRules()
      .then((result) => {
        if (!cancelled) setRules(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t('automation.no-se-pudieron-cargar-las-reglas'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = () => setAttempt((value) => value + 1)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setConditionError(null)
    setActionError(null)
    setFormOpen(true)
  }

  const openEdit = (rule: SavedRule) => {
    setEditing(rule)
    setForm({
      code: rule.code,
      name: rule.name,
      description: rule.description ?? '',
      severity: rule.severity,
      condition: rule.condition ? JSON.stringify(rule.condition, null, 2) : '',
      action: rule.action ? JSON.stringify(rule.action, null, 2) : '',
    })
    setFormError(null)
    setConditionError(null)
    setActionError(null)
    setFormOpen(true)
  }

  const parseJsonObject = (
    raw: string,
  ): { value: Record<string, unknown> | null; error: string | null } => {
    if (!raw.trim()) return { value: null, error: null }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { value: null, error: t('automation.debe-ser-un-objeto-json') }
      }
      return { value: parsed as Record<string, unknown>, error: null }
    } catch {
      return { value: null, error: t('automation.el-json-no-es-valido-revisa-comas-y-comillas') }
    }
  }

  const handleSubmit = async () => {
    const codeValue = form.code.trim()
    const name = cleanText(form.name)
    const description = cleanText(form.description)
    if (codeValue.length < 1 || codeValue.length > 50) {
      setFormError(t('automation.el-codigo-debe-tener-entre-1-y-50-caracteres'))
      return
    }
    const codeError = code(50)(codeValue)
    if (codeError) {
      setFormError(codeError)
      return
    }
    if (name.length < 3) {
      setFormError(t('automation.el-nombre-debe-tener-al-menos-3-caracteres'))
      return
    }
    const nameMaxError = maxLength(150, 'El nombre debe tener como máximo 150 caracteres.')(name)
    if (nameMaxError) {
      setFormError(nameMaxError)
      return
    }
    const nameLetterError = hasLetter()(name)
    if (nameLetterError) {
      setFormError(nameLetterError)
      return
    }
    const descriptionMaxError = maxLength(
      500,
      'La descripción no puede superar 500 caracteres.',
    )(description)
    if (descriptionMaxError) {
      setFormError(descriptionMaxError)
      return
    }
    const condition = parseJsonObject(form.condition)
    const action = parseJsonObject(form.action)
    setConditionError(condition.error)
    setActionError(action.error)
    if (condition.error || action.error) return

    const input: SavedRuleInput = {
      code: codeValue,
      name,
      description: description || null,
      severity: form.severity,
      condition: condition.value,
      action: action.value,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSavedRule(editing.id, input)
        toast.success(t('automation.regla-actualizada'), `${name} ${t('automation.se-guardo-correctamente')}`)
      } else {
        await createSavedRule(input)
        toast.success(t('automation.regla-creada'), `${name} ${t('automation.ya-esta-registrada-en-el-backend')}`)
      }
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : t('automation.no-se-pudo-guardar-la-regla'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteSavedRule(deleting.id)
      toast.success(t('automation.regla-eliminada'), `${deleting.name} ${t('automation.se-quito-del-listado')}`)
      setDeleting(null)
      reload()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : t('automation.no-se-pudo-eliminar-la-regla'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-gray-600">
          {t('automation.reglas-guardadas-en-el-backend-codigo-severidad-condicion-y-accion-en-json')}
        </p>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('automation.nueva-regla')}
        </Button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                {t('automation.reintentar')}
              </Button>
            }
          />
        </div>
      ) : loading && rules.length === 0 ? (
        <div className="card">
          <DataTable headers={[t('automation.codigo'), t('automation.nombre'), t('automation.severidad'), t('automation.estado'), '']}>
            <TableStateRow colSpan={5}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                {t('automation.cargando-reglas')}
              </span>
            </TableStateRow>
          </DataTable>
        </div>
      ) : rules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title={t('automation.sin-reglas-guardadas')}
            description={t('automation.crea-la-primera-regla-para-que-el-backend-automatice-decisiones-de-negocio')}
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t('automation.nueva-regla')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <DataTable headers={[t('automation.codigo'), t('automation.nombre'), t('automation.severidad'), t('automation.estado'), t('automation.acciones')]}>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-mono font-medium text-gray-900">{rule.code}</TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">{rule.name}</div>
                  {rule.description && (
                    <div className="max-w-72 truncate text-caption text-gray-500">
                      {rule.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={SEVERITY_BADGES[rule.severity]}>
                    {t(SEVERITY_KEYS[rule.severity])}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.status === 'inactive' ? 'neutral' : 'success'}>
                    {rule.status === 'inactive' ? t('automation.inactiva') : t('automation.activa')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      aria-label={`${t('automation.editar')} ${rule.name}`}
                      title={t('automation.editar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(rule)
                      }}
                      aria-label={`${t('automation.eliminar')} ${rule.name}`}
                      title={t('automation.eliminar')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
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
        title={editing ? t('automation.editar-regla') : t('automation.nueva-regla')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('automation.cancelar')}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t('automation.guardar-cambios') : t('automation.crear-regla')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('automation.codigo')}
              required
              maxLength={50}
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder={t('automation.ej-alerta-stock-critico')}
              error={formError ?? undefined}
              autoFocus
            />
            <Select
              label={t('automation.severidad')}
              required
              value={form.severity}
              onChange={(event) =>
                setForm({ ...form, severity: event.target.value as RuleSeverity })
              }
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {t(SEVERITY_KEYS[severity])}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label={t('automation.nombre')}
            required
            minLength={3}
            maxLength={150}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={t('automation.ej-alerta-de-stock-critico')}
          />
          <Textarea
            label={t('automation.descripcion')}
            hint={t('automation.opcional-que-hace-esta-regla')}
            maxLength={500}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder={t('automation.ej-avisa-cuando-un-producto-baje-del-stock-minimo')}
          />
          <Textarea
            label={t('automation.condicion-json')}
            hint={t('automation.opcional-se-valida-como-objeto-json')}
            value={form.condition}
            onChange={(event) => {
              setForm({ ...form, condition: event.target.value })
              setConditionError(null)
            }}
            placeholder={'{"stock_minimo": 10}'}
            error={conditionError ?? undefined}
            className="font-mono text-caption"
          />
          <Textarea
            label={t('automation.accion-json')}
            hint={t('automation.opcional-se-valida-como-objeto-json')}
            value={form.action}
            onChange={(event) => {
              setForm({ ...form, action: event.target.value })
              setActionError(null)
            }}
            placeholder={'{"tipo": "notificacion", "nivel": "warning"}'}
            error={actionError ?? undefined}
            className="font-mono text-caption"
          />
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('automation.eliminar-regla')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('automation.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('automation.eliminar')}
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-gray-700">
          {t('automation.eliminar-la-regla')}{' '}<strong>{deleting?.name}</strong> ({deleting?.code})?
        </p>
        {deleteError && (
          <p className="mt-3 rounded-md bg-error-bg px-3 py-2 text-caption text-error-fg">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}
