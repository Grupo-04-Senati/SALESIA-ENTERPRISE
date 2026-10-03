interface HotZoneProps {
  /** Abre el sidebar al entrar el cursor en la zona. */
  onEnter: () => void
}

/**
 * Zona invisible de detección (txt: hot zone) — div fijo de 12px (w-3) en el
 * borde izquierdo, sin fondo visible, z-40 (por debajo del sidebar z-50).
 * Es el único punto de entrada para mostrar el sidebar auto-hide.
 */
export default function HotZone({ onEnter }: HotZoneProps) {
  return (
    <div
      onMouseEnter={onEnter}
      aria-hidden="true"
      className="fixed left-0 top-0 z-40 h-full w-3"
    />
  )
}
