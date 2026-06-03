/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sepia base palette — warm, aged-paper tones.
        sepia: {
          50: '#faf4e8',
          100: '#f4ead3',
          200: '#e9d6ad',
          300: '#dcbf85',
          400: '#c9a15c',
          500: '#b1843e',
          600: '#8a6d3b',
          700: '#6b5430',
          800: '#4a3a23',
          900: '#2e2417',
          950: '#1c160e',
        },
      },
      fontFamily: {
        // Typewriter typography.
        typewriter: ['"Courier Prime"', '"Special Elite"', 'ui-monospace', 'monospace'],
        display: ['"Special Elite"', '"Courier Prime"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(46, 36, 23, 0.15), 0 2px 8px rgba(46, 36, 23, 0.08)',
      },
    },
  },
  plugins: [],
}
