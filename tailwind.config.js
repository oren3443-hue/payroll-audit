/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        critical: { DEFAULT: '#ef4444', light: '#fef2f2', border: '#fca5a5' },
        high:     { DEFAULT: '#f97316', light: '#fff7ed', border: '#fdba74' },
        medium:   { DEFAULT: '#eab308', light: '#fefce8', border: '#fde047' },
        low:      { DEFAULT: '#22c55e', light: '#f0fdf4', border: '#86efac' },
      },
    },
  },
  plugins: [],
}
