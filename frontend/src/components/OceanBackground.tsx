import { useEffect, useRef, useState } from 'react'
import { createRenderer } from '@/ocean/renderer'

/**
 * Fondo animado «Particles ocean» — vgpu example `fft-ocean`.
 *
 * Fuente oficial descargada y verificada (SHA-256) en `./fft-ocean/`
 * y copiada a `./src/ocean/`. Adaptaciones respecto al example original:
 *
 * - El example renderiza sobre `bg-black` dentro de su propio contenedor;
 *   aquí el lienzo se usa como capa de fondo a pantalla completa y la
 *   página conserva su gradiente azul→cyan como respaldo.
 * - Si WebGPU no está disponible (o la preparación falla), la capa negra
 *   se oculta y queda visible el gradiente original de la página.
 * - El ciclo de vida es idéntico al original: `createRenderer` al montar,
 *   `renderer.dispose()` al desmontar (libera frameLoop, resize y GPU).
 *   Si la preparación falla, el propio renderer ya se auto-depone.
 */
export default function OceanBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: ReturnType<typeof createRenderer>
    try {
      renderer = createRenderer({ canvas })
    } catch {
      // init() puede fallar de forma síncrona si el entorno no soporta WebGPU.
      setFailed(true)
      return
    }

    // El renderer se auto-depone dentro de fail(); aquí solo ocultamos la capa.
    void renderer.ready.catch(() => setFailed(true))

    return () => renderer.dispose()
  }, [])

  if (failed) return null

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  )
}
