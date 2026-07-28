import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#FDFBF0',
          100: '#FDF6D8',
          200: '#FAEAA6',
          300: '#F5D96E',
          400: '#EFC440',
          500: '#D4A017',  // primary brand gold
          600: '#B8880F',
          700: '#9A6F0B',
          800: '#7A5608',
          900: '#5C3E06',
        },
        dark: {
          50:  '#F5F5F5',
          100: '#E8E8E8',
          200: '#C8C8C8',
          300: '#9A9A9A',
          400: '#6A6A6A',
          500: '#444444',
          600: '#333333',
          700: '#2C2C2C',
          800: '#1A1A1A',  // primary brand black
          900: '#0F0F0F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
