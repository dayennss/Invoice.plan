import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        green: {
          DEFAULT: '#19C463',
          light: '#27E077',
          dark: '#0B6B3A',
        },
        graphite: '#1E2421',
        // Semânticos
        background: 'var(--bg-base)',
        card: 'var(--bg-card)',
        border: 'rgba(168,178,173,0.12)',
        // Financeiros
        income: '#27E077',
        expense: '#F43F5E',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease forwards',
        'slide-in': 'slide-in 0.25s ease forwards',
      },
    },
  },
  plugins: [],
}

export default config
