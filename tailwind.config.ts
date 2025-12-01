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
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          500: 'var(--color-accent)',
        },
        background: 'var(--color-bg)',
        foreground: 'var(--color-text)',
        warmWhite: 'var(--color-warm-white)',
        nude: 'var(--color-nude)',
        beige: 'var(--color-beige)',
        earthTone: 'var(--color-earth-tone)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
        logo: ['Quicksand', 'sans-serif'],
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