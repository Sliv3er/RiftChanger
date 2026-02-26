/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        primary: { 500: '#C89B3C', 600: '#b8862b', 700: '#9a6d1f' },
        dark: { 800: '#1a1a1a', 850: '#141414', 900: '#0a0a0a', 950: '#000000' },
        gold: {
          50: '#fefdf7', 100: '#fdf9e7', 200: '#f9f1c2', 300: '#f4e68d',
          400: '#f0d958', 500: '#C89B3C', 600: '#b8862b', 700: '#9a6d1f',
          800: '#7d5519', 900: '#5c3e11',
        }
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
