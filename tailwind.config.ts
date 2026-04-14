import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0A0A0B',
          elevated: '#111113',
          border: '#1F1F23',
        },
        fg: {
          DEFAULT: '#F4F4F5',
          muted: '#A1A1AA',
        },
        accent: {
          DEFAULT: '#00FF88',
          hover: '#00E67A',
        },
        electric: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #00FF88 0%, #3B82F6 100%)',
        'gradient-glow': 'radial-gradient(circle at 50% 0%, rgba(0,255,136,0.15), transparent 60%)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
