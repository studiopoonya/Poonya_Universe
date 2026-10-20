import { fontFamily } from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Nunito"', ...fontFamily.sans],
      },
      colors: {
        // brand maps to cartoon purple — existing code auto-inherits
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          900: '#2e1065',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#FFF8F0',   // warm cream
          subtle:  '#FFF0E4',   // deeper cream
        },
        ink: '#1A1A2E',         // cartoon borders + hard shadows
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        // cartoon hard offset shadows
        'cartoon-sm': '3px 3px 0px #1A1A2E',
        'cartoon':    '4px 4px 0px #1A1A2E',
        'cartoon-lg': '6px 6px 0px #1A1A2E',
        'cartoon-xl': '8px 8px 0px #1A1A2E',
        // keep legacy names pointing to cartoon equivalents
        card:         '4px 4px 0px #1A1A2E',
        'card-hover': '6px 6px 0px #1A1A2E',
        glass:        '4px 4px 0px #1A1A2E',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
