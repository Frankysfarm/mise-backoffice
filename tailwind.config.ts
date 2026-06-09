import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        matcha: {
          50: '#f0f7f3', 100: '#dbeee3', 200: '#b7ddc7',
          300: '#86c3a2', 400: '#55a47c', 500: '#2d6b45',
          600: '#245638', 700: '#1a3a2a', 800: '#122920', 900: '#0d1f16',
        },
        gold:    { DEFAULT: '#d4a843', soft: '#f0e6d3' },
        surface: { DEFAULT: '#f5f2ed', warm: '#f0e6d3' },
        // Lieferdienst-UI theme colors
        saffron: { DEFAULT: '#f4a623', light: '#fef3dc', dark: '#c5830c' },
        char:    '#1c1917',
        steel:   '#6b7280',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-body)',    'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(26, 58, 42, 0.04), 0 1px 1px rgba(26, 58, 42, 0.03)',
        soft:   '0 4px 16px rgba(26, 58, 42, 0.06), 0 2px 4px rgba(26, 58, 42, 0.04)',
        strong: '0 12px 32px rgba(26, 58, 42, 0.12), 0 4px 8px rgba(26, 58, 42, 0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
export default config;
