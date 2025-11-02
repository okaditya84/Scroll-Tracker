import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef0ff',
          100: '#d7dbff',
          200: '#b0b9ff',
          300: '#8894ff',
          400: '#6170ff',
          500: '#394cff',
          600: '#1c2fed',
          700: '#1423b4',
          800: '#0e187b',
          900: '#070d42'
        }
      },
      fontFamily: {
        sans: ['"SF Pro Display"', ...fontFamily.sans]
      },
      boxShadow: {
        glow: '0 20px 50px -25px rgba(57, 76, 255, 0.45)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
