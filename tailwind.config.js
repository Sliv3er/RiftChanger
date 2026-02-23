/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        league: {
          blue: {
            darkest: '#010A13',
            darker: '#0A1428',
            deep: '#0A323C',
            medium: '#0397AB',
            light: '#0AC8B9',
            accent: '#005A82',
            muted: '#0E2029',
            glow: '#64CDE2',
          },
          gold: {
            dark: '#785A28',
            DEFAULT: '#C8AA6E',
            light: '#F0E6D2',
            bright: '#C89B3C',
            pale: '#E8D6A0',
            vivid: '#F0B232',
          },
          grey: {
            dark: '#1E2328',
            DEFAULT: '#3C3C41',
            cool: '#1E282D',
            light: '#A09B8C',
            lightest: '#5B5A56',
            muted: '#2B2F33',
          },
          hextech: {
            black: '#010A13',
            metal: '#1E2328',
          },
          red: {
            DEFAULT: '#C24B4B',
            dark: '#6B2A2A',
          },
          green: {
            DEFAULT: '#0ACE83',
            dark: '#0A3C2E',
          },
        },
      },
      fontFamily: {
        beaufort: ['"Beaufort for LOL"', '"Cinzel"', 'serif'],
        spiegel: ['"Spiegel"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 3s linear infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite alternate',
        'count-up': 'countUp 1s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(200, 170, 110, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(200, 170, 110, 0.6)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(200, 170, 110, 0.2), inset 0 0 5px rgba(200, 170, 110, 0.1)' },
          '100%': { boxShadow: '0 0 15px rgba(200, 170, 110, 0.4), inset 0 0 10px rgba(200, 170, 110, 0.2)' },
        },
        borderGlow: {
          '0%': { borderColor: 'rgba(200, 170, 110, 0.3)' },
          '100%': { borderColor: 'rgba(200, 170, 110, 0.8)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(180deg, #C89B3C 0%, #785A28 100%)',
        'gold-gradient-h': 'linear-gradient(90deg, #785A28 0%, #C8AA6E 50%, #785A28 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0A1428 0%, #010A13 100%)',
        'card-gradient': 'linear-gradient(180deg, #1E282D 0%, #0A1428 100%)',
        'hero-gradient': 'linear-gradient(180deg, transparent 0%, #010A13 100%)',
      },
      boxShadow: {
        'gold': '0 0 10px rgba(200, 170, 110, 0.3)',
        'gold-lg': '0 0 20px rgba(200, 170, 110, 0.4)',
        'inner-gold': 'inset 0 0 10px rgba(200, 170, 110, 0.15)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(200, 170, 110, 0.2)',
      },
    },
  },
  plugins: [],
};
