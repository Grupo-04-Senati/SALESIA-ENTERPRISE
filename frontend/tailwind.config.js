/** @type {import('tailwindcss').Config} */
// ============================================================
// SalesIA Enterprise — Sistema de diseño (Fase 03)
// Fuente: "SISTEMA DE DISEÑO - SALESIA ENTERPRISE" (txt)
// Paleta definida en el PDF: azul corporativo, cyan, blanco y grises
// ============================================================
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Colores principales (definidos en el PDF) ---
        primary: {
          DEFAULT: '#1E3A8A', // azul corporativo
          hover: '#1E40AF',
          light: '#3B82F6', // azul claro
          'light-hover': '#2563EB',
        },
        accent: {
          DEFAULT: '#06B6D4', // cyan
          hover: '#0891B2',
        },
        // --- Grises (neutros) ---
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // --- Colores de estado ---
        success: { DEFAULT: '#10B981', bg: '#D1FAE5', fg: '#065F46' },
        error: { DEFAULT: '#EF4444', bg: '#FEE2E2', fg: '#991B1B' },
        warning: { DEFAULT: '#F59E0B', bg: '#FEF3C7', fg: '#92400E' },
        info: { DEFAULT: '#06B6D4', bg: '#CFFAFE', fg: '#155E75' },
        loading: '#3B82F6',
        empty: '#9CA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      // --- Escala tipográfica ---
      fontSize: {
        h1: ['30px', { lineHeight: '36px', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        h4: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '16px' }],
        kpi: ['36px', { lineHeight: '44px', fontWeight: '700' }],
      },
      // --- Bordes (radios) ---
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      // --- Sombras ---
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.05)',
        medium: '0 4px 6px rgba(0,0,0,0.07)',
        large: '0 10px 15px rgba(0,0,0,0.1)',
        modal: '0 20px 25px rgba(0,0,0,0.15)',
      },
      // --- Breakpoints (txt §9): tablet 640-1024, desktop 1024-1440, wide >1440 ---
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1440px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}
