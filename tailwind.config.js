/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        league: {
          gold: '#C89B3C',
          'gold-light': '#F0E6D2',
          'gold-dark': '#785A28',
          blue: '#0397AB',
          'blue-dark': '#0A1428',
          'blue-deeper': '#091428',
          'blue-darkest': '#010A13',
          grey: '#A09B8C',
          'grey-dark': '#3C3C41',
          'grey-cool': '#1E2328',
          red: '#C8AA6E',
          'border': '#463714',
          'border-light': '#785A28',
        },
      },
      fontFamily: {
        beaufort: ['"Beaufort for LOL"', 'serif'],
        spiegel: ['Spiegel', 'sans-serif'],
      },
      backgroundImage: {
        'league-gradient': 'linear-gradient(180deg, #091428 0%, #0A1428 100%)',
        'gold-gradient': 'linear-gradient(180deg, #785A28 0%, #C89B3C 50%, #785A28 100%)',
      },
    },
  },
  plugins: [],
};
