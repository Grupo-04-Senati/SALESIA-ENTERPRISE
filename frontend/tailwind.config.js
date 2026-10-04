/** @type {import('tailwindcss').Config} */
// ============================================================
// SalesIA Enterprise — Sistema de diseño "Diseno E" (webadmin)
// Paleta restringida: azul / blanco / negro.
// Montserrat (headlines) + IBM Plex Sans (body), radios 12px / píldora.
// ============================================================
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Azules del Diseño E ---
        primary: {
          DEFAULT: '#0939E6', // azul E principal
          hover: '#0054BC', // azul profundo (hover)
          light: '#8FB0FF', // azul claro (indicadores)
          'light-hover': '#6B91F5',
        },
        accent: {
          DEFAULT: '#0054BC', // azul secundario (antes cyan)
          hover: '#00439A',
        },
        // --- Grises (neutros) ---
        gray: {
          50: '#F8F9FB',
          100: '#F3F5F9',
          200: '#EFF0F2',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#7B8190',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // --- Colores de estado (badges de datos) ---
        success: { DEFAULT: '#10B981', bg: '#D1FAE5', fg: '#065F46' },
        error: { DEFAULT: '#EF4444', bg: '#FEE2E2', fg: '#991B1B' },
        warning: { DEFAULT: '#F59E0B', bg: '#FEF3C7', fg: '#92400E' },
        info: { DEFAULT: '#0939E6', bg: '#E8EEFF', fg: '#0054BC' },
        loading: '#0939E6',
        empty: '#9CA3AF',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        head: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
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
      // --- Sombras (Diseño E: única sombra sutil) ---
      boxShadow: {
        subtle: 'rgba(52, 58, 64, 0.06) 0px -2px 5px 0px',
        medium: '0 4px 12px rgba(52,58,64,0.08)',
        large: '0 14px 30px rgba(52,58,64,0.14)',
        modal: '0 24px 60px rgba(52,58,64,0.22)',
        blue: '0 6px 16px rgba(9,57,230,0.30)',
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
