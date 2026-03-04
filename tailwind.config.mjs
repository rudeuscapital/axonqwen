/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        sans:    ['Syne', 'sans-serif'],
      },
      colors: {
        ink:    '#040811',
        paper:  '#f5f2eb',
        paper2: '#ede9df',
        wire:   '#0e1120',
        border: '#d8d2c5',
        muted:  '#6b7490',
        dim:    '#1a1f35',
        accent:  '#00c8ff',
        accent2: '#ff4444',
        gold:    '#e8c84a',
        green:   '#00e09a',
      },
      animation: {
        'ticker':    'ticker 30s linear infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-up':   'fade-up 0.7s ease forwards',
        'scan':      'scan 8s linear infinite',
      },
      keyframes: {
        ticker:      { '0%': { transform:'translateX(0)' },     '100%': { transform:'translateX(-50%)' } },
        'pulse-dot': { '0%,100%': { opacity:'1' },              '50%':  { opacity:'0.3' } },
        'fade-up':   { '0%': { opacity:'0', transform:'translateY(24px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        scan:        { '0%': { transform:'translateY(-100%)' }, '100%': { transform:'translateY(100vh)' } },
      },
    },
  },
  plugins: [],
};
