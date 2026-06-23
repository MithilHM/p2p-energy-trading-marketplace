/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Foundation — backgrounds & surfaces
        charcoal: '#0a0e14',
        slate: {
          850: '#16202e', // custom mid-surface between 800 and 900
        },
        // Semantic — energy production (emerald / teal)
        production: {
          DEFAULT: '#10b981', // emerald-500
          deep: '#059669', // emerald-600
          alt: '#14b8a6', // teal-500
        },
        // Semantic — consumption (blue / indigo)
        consumption: {
          DEFAULT: '#3b82f6', // blue-500
          alt: '#6366f1', // indigo-500
        },
        // Semantic — market activity (amber / gold)
        market: {
          DEFAULT: '#f59e0b', // amber-500
          gold: '#d4a017',
        },
        // Semantic — forecasting (violet / purple)
        forecast: {
          DEFAULT: '#8b5cf6', // violet-500
          alt: '#a855f7', // purple-500
        },
        // Semantic — alerts (coral / red)
        alert: {
          DEFAULT: '#f43f5e', // rose/coral
          deep: '#ef4444', // red-500
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        'tightest': '-0.03em',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)',
        'panel-hover': '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}
