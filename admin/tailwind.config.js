/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F0B07',
        surface: '#1A130B',
        surface2: '#241A0F',
        gold: '#D4A437',
        goldDark: '#A37D26',
        border: '#3A2A1A',
        ok: '#34C759',
        warn: '#FFCC00',
        info: '#0A84FF',
        danger: '#FF453A',
        muted: '#9C9388',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
