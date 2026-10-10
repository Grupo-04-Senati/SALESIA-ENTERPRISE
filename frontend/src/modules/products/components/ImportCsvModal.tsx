import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/form'
import { Spinner } from '@/components/feedback/Loader'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import {
  previewProductImport,
  runProductImport,
  type ImportPreview,
  type ImportResult,
} from '../services/productService'

/**
 * Importador de productos por CSV (Catálogo → Productos).
 * Vista previa por fila antes de escribir nada; el stock inicial se registra
 * como entrada en el kardex para que las ventas descuenten bien.
 * Las plantillas de ejemplo viven en public/plantillas/ (servidas por Vercel).
 */

const TEMPLATE_URL = '/plantillas/productos-ejemplo.csv'
const TEMPLATE_EXCEL_URL = '/plantillas/productos-ejemplo-excel-es.csv'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportCsvModal({ open, onClose, onImported }: Props) {
  const { t } = useLang()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [csvText, setCsvText] = useState('')

  useEffect(() => {
    if (open) return
    setFileName('')
    setPreview(null)
    setUpdateExisting(false)
    setLoading(false)
    setImporting(false)
    setError(null)
    setResult(null)
    setCsvText('')
  }, [open])

  const loadPreview = async (text: string, update: boolean) => {
    setLoading(true)
    setError(null)
    try {
      setPreview(await previewProductImport(text, update))
    } catch (reason: unknown) {
      setPreview(null)
      setError(reason instanceof Error ? reason.message : t('products.import-error'))
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const raw = await file.text()
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    setCsvText(text)
    await loadPreview(text, updateExisting)
  }

  const handleToggleUpdate = async (checked: boolean) => {
    setUpdateExisting(checked)
    if (csvText) await loadPreview(csvText, checked)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const imported = await runProductImport(csvText, updateExisting)
      setResult(imported)
      setPreview(null)
      toast.success(
        t('products.import-listo'),
        t('products.import-resumen', {
          created: imported.created,
          updated: imported.updated,
          stock: imported.stock_movements,
        }),
      )
      onImported()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('products.import-error'))
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = (url: string, name: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
  }

  const actionBadge = (action: string) => {
    if (action === 'create') return <Badge variant="success">{t('products.import-accion-crear')}</Badge>
    if (action === 'update') return <Badge variant="primary">{t('products.import-accion-actualizar')}</Badge>
    return <Badge variant="error">{t('products.import-accion-error')}</Badge>
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="products.importar-csv"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => downloadTemplate(TEMPLATE_URL, 'plantilla-productos.csv')}
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {t('products.import-plantilla')}
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} type="button">
              {t('products.cancelar')}
            </Button>
            {preview && preview.valid_rows > 0 && !result && (
              <Button onClick={() => void handleImport()} disabled={importing} type="button">
                {importing ? (
                  <Spinner size={16} />
                ) : (
                  <Upload aria-hidden="true" className="h-4 w-4" />
                )}
                {t('products.import-confirmar', {
                  create: preview.will_create,
                  update: preview.will_update,
                })}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {result ? (
        <div className="space-y-3 text-body-sm text-gray-700">
          <p className="font-semibold text-gray-900">{t('products.import-listo')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('products.import-res-creados', { n: result.created })}</li>
            <li>{t('products.import-res-actualizados', { n: result.updated })}</li>
            <li>{t('products.import-res-categorias', { n: result.categories_created })}</li>
            <li>{t('products.import-res-kardex', { n: result.stock_movements })}</li>
            {result.skipped > 0 && (
              <li className="text-warning">{t('products.import-res-omitidas', { n: result.skipped })}</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              aria-label={t('products.import-archivo')}
              className="hidden"
              onChange={(event) => void handleFile(event)}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} type="button">
              <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
              {fileName || t('products.import-elegir-archivo')}
            </Button>
            <Checkbox
              label={t('products.import-actualizar-existente')}
              checked={updateExisting}
              onChange={(event) => void handleToggleUpdate(event.target.checked)}
            />
          </div>

          <p className="text-caption text-gray-500">{t('products.import-ayuda')}</p>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
            <span className="text-gray-500">{t('products.import-plantillas-proyecto')}:</span>
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={TEMPLATE_URL}
              download="plantilla-productos.csv"
            >
              {t('products.import-plantilla-coma')}
            </a>
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={TEMPLATE_EXCEL_URL}
              download="plantilla-productos-excel-es.csv"
            >
              {t('products.import-plantilla-excel')}
            </a>
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="/plantillas/LEEME.txt"
              download="LEEME-plantillas.txt"
            >
              {t('products.import-plantilla-leeme')}
            </a>
          </p>

          {error && <p className="text-body-sm text-error">{error}</p>}

          {loading && (
            <p className="inline-flex items-center gap-2 text-body-sm text-gray-500">
              <Spinner size={16} className="text-loading" />
              {t('products.import-analizando')}
            </p>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-body-sm">
                <Badge variant="success">{t('products.import-validas', { n: preview.valid_rows })}</Badge>
                <Badge variant={preview.error_rows > 0 ? 'error' : 'neutral'}>
                  {t('products.import-con-error', { n: preview.error_rows })}
                </Badge>
                {preview.new_categories.length > 0 && (
                  <Badge variant="primary">
                    {t('products.import-categorias-nuevas', { n: preview.new_categories.length })}
                  </Badge>
                )}
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-caption">
                  <thead className="sticky top-0 bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('products.import-col-fila')}</th>
                      <th className="px-3 py-2 font-medium">{t('products.sku')}</th>
                      <th className="px-3 py-2 font-medium">{t('products.producto')}</th>
                      <th className="px-3 py-2 font-medium">{t('products.categoria')}</th>
                      <th className="px-3 py-2 font-medium">{t('products.import-col-accion')}</th>
                      <th className="px-3 py-2 font-medium">{t('products.import-col-motivo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">{row.line}</td>
                        <td className="px-3 py-1.5 font-mono">{row.data?.sku ?? '—'}</td>
                        <td className="max-w-40 truncate px-3 py-1.5">{row.data?.name ?? '—'}</td>
                        <td className="max-w-32 truncate px-3 py-1.5">{row.data?.category ?? '—'}</td>
                        <td className="px-3 py-1.5">{actionBadge(row.action)}</td>
                        <td className="max-w-56 px-3 py-1.5 text-gray-600">
                          {row.errors.length > 0 ? row.errors.join(' · ') : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
