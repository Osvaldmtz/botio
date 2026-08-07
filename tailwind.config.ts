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
        // design-emailing tokens (scoped prefix ky-)
        ky: {
          bg: '#F1F3F8',
          'surface-0': '#FFFFFF',
          'surface-1': '#F8F9FC',
          border: '#E4E7EF',
          'border-subtle': '#EEF0F6',
          'text-primary': '#1A1B2E',
          'text-secondary': '#5C6380',
          'text-muted': '#9299B0',
          accent: '#7C3AED',
          'accent-light': '#EDE9FE',
          'accent-dark': '#5B21B6',
          positive: '#16A34A',
          'positive-bg': '#DCFCE7',
          negative: '#DC2626',
          'negative-bg': '#FEE2E2',
          warning: '#D97706',
          'warning-bg': '#FEF3C7',
          chart: {
            1: '#7C3AED',
            2: '#F97316',
            3: '#94A3B8',
            'area-1': 'rgba(124, 58, 237, 0.10)',
          },
          nav: '#1A1B2E',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        card: '8px',
        'ky-card': '16px',
        'ky-btn': '10px',
        'ky-input': '10px',
        'ky-modal': '20px',
        'ky-badge': '999px',
        'ky-tooltip': '8px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        'ky-sans': ['var(--font-ky-sans)', 'Inter', 'system-ui', 'sans-serif'],
        'ky-mono': [
          'var(--font-ky-mono)',
          'JetBrains Mono',
          'ui-monospace',
          'monospace',
        ],
      },
      fontSize: {
        'ky-display': [
          '32px',
          { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '600' },
        ],
        'ky-h1': [
          '24px',
          { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'ky-h2': [
          '18px',
          { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' },
        ],
        'ky-h3': ['16px', { lineHeight: '1.4', fontWeight: '500' }],
        'ky-body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'ky-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'ky-caption': [
          '12px',
          { lineHeight: '1.4', letterSpacing: '0.02em', fontWeight: '500' },
        ],
      },
      boxShadow: {
        'ky-modal': '0 20px 60px rgba(26, 27, 46, 0.12)',
      },
      height: {
        'ky-topbar': '64px',
      },
      spacing: {
        'ky-section': '24px',
        'ky-card': '24px',
        'ky-gap': '16px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      maxWidth: {
        dashboard: '1400px',
        kalyo: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
