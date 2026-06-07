import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#FFFFFF',
          elevated: '#FAFAFA',
          subtle: '#F4F4F5',
          border: '#E4E4E7',
          'border-hover': '#D4D4D8',
        },
        fg: {
          DEFAULT: '#18181B',
          muted: '#71717A',
          tertiary: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#10B981',
          hover: '#059669',
          muted: '#D1FAE5',
          'muted-fg': '#047857',
        },
        semantic: {
          warning: '#F59E0B',
          'warning-bg': '#FEF3C7',
          hot: '#EF4444',
          'hot-bg': '#FEE2E2',
          info: '#3B82F6',
          'info-bg': '#DBEAFE',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        card: '8px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      maxWidth: {
        dashboard: '1400px',
      },
    },
  },
  plugins: [],
};

export default config;
