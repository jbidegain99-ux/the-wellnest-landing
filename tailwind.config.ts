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
        primary: {
          DEFAULT: 'var(--color-primary)',
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          500: 'var(--color-primary)',
          600: 'var(--color-primary-600)',
          700: '#5A6E4E',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          500: 'var(--color-accent)',
          600: '#A88A5F',
        },
        background: 'var(--color-bg)',
        foreground: 'var(--color-text)',
        warmWhite: 'var(--color-warm-white)',
        nude: 'var(--color-nude)',
        beige: {
          DEFAULT: 'var(--color-beige)',
          dark: 'var(--color-beige-dark)',
        },
        cream: 'var(--color-cream)',
        earthTone: 'var(--color-earth-tone)',
        // Improved muted text color for better contrast
        muted: {
          DEFAULT: '#5D5D5D',
          foreground: '#4A4A4A',
        },
      },
      fontFamily: {
        sans: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        logo: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config