/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Mission Control Palette ───
        surface: {
          DEFAULT: '#131318',
          dark: '#0a0a0f',
          light: '#1a1a28',
          hover: '#22223a',
          dim: '#131318',
          bright: '#39383e',
          lowest: '#0e0e13',
          low: '#1b1b20',
          container: '#1f1f25',
          high: '#2a292f',
          highest: '#35343a',
          variant: '#35343a',
        },
        accent: {
          DEFAULT: '#00d4ff',
          dim: '#00a8cc',
          light: '#a8e8ff',
          glow: 'rgba(0, 212, 255, 0.15)',
          fixed: '#b4ebff',
          'fixed-dim': '#3cd7ff',
        },
        success: {
          DEFAULT: '#00ff88',
          dim: '#00cc6a',
          container: '#00df76',
        },
        warning: {
          DEFAULT: '#ffaa00',
          dim: '#cc8800',
        },
        danger: {
          DEFAULT: '#ff4466',
          dim: '#cc3355',
          light: '#ffb4ab',
        },
        text: {
          DEFAULT: '#e0e0e8',
          muted: '#8888a0',
          dim: '#555570',
          surface: '#e4e1e9',
        },
        outline: {
          DEFAULT: '#859398',
          variant: '#3c494e',
        },
        secondary: {
          DEFAULT: '#c5c3e6',
          container: '#444461',
        },
        tertiary: {
          DEFAULT: '#00ff88',
          container: '#00df76',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        headline: ['Plus Jakarta Sans', 'sans-serif'],
        label: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(0, 212, 255, 0.2)',
        'glow-accent-lg': '0 0 35px rgba(0, 212, 255, 0.3)',
        'glow-success': '0 0 20px rgba(0, 255, 136, 0.2)',
        'glow-danger': '0 0 20px rgba(255, 68, 102, 0.2)',
        'glow-warning': '0 0 20px rgba(255, 170, 0, 0.2)',
        'sidebar': '4px 0 24px rgba(0, 212, 255, 0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
    },
  },
  plugins: [],
};
