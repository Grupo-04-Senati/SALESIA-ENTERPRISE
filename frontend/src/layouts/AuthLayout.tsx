import { BarChart3, ShieldCheck, Zap } from 'lucide-react'
import { Outlet } from 'react-router-dom'

/**
 * Layout de autenticación — Diseño E (webadmin):
 * panel izquierdo azul con la marca y el valor del producto,
 * formulario a la derecha sobre fondo claro (oscuro en dark mode).
 */
const HIGHLIGHTS = [
  { icon: BarChart3, text: 'Analítica de ventas en tiempo real' },
  { icon: ShieldCheck, text: 'Gestión por roles y accesos seguros' },
  { icon: Zap, text: 'Automatizaciones y reportes automáticos' },
] as const

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Panel de marca */}
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-primary p-10 text-white md:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5"
        />

        <div className="relative flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Logo de SalesIA Enterprise"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white/40"
          />
          <div>
            <p className="font-head text-base font-semibold">SalesIA Enterprise</p>
            <p className="text-caption text-white/70">Sistema de Gestión y Analítica</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-sm font-head text-[30px] font-semibold leading-9 text-white">
            Gestiona tu operación con datos claros y decisiones rápidas.
          </h1>
          <p className="mt-3 max-w-sm text-body-sm text-white/75">
            Ventas, inventario, clientes y analítica estadística en un solo lugar.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-body-sm text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-caption text-white/60">
          © {new Date().getFullYear()} SalesIA Enterprise · Senati
        </p>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex flex-col items-center text-center md:hidden">
            <img
              src="/logo.jpg"
              alt="Logo de SalesIA Enterprise"
              className="mb-3 h-14 w-14 rounded-full object-cover"
            />
            <h1 className="text-h3 text-gray-900">SalesIA Enterprise</h1>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
