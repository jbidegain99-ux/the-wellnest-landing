import type { Metadata } from 'next'
import { Quicksand, Poppins } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Providers } from '@/components/providers/Providers'

// Tipografía primaria: Quicksand - para logo y títulos de marca
const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  weight: ['300', '400', '500', '600', '700'],
})

// Tipografía secundaria: Poppins - para UI y textos de body
const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://the-wellnest-landing.vercel.app'),
  title: 'The Wellnest | Estudio de Bienestar Integral',
  description: 'Tu santuario de bienestar en El Salvador. Yoga, Pilates Mat, Pole Fitness, Terapia de Sonido y Nutrición en un solo lugar. Usa tus clases en cualquier disciplina.',
  keywords: ['yoga', 'pilates', 'pole fitness', 'terapia de sonido', 'nutrición', 'bienestar', 'wellness', 'El Salvador'],
  authors: [{ name: 'The Wellnest' }],
  openGraph: {
    title: 'The Wellnest | Estudio de Bienestar Integral',
    description: 'Tu santuario de bienestar en El Salvador. Múltiples disciplinas, un solo lugar.',
    type: 'website',
    locale: 'es_SV',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${quicksand.variable} ${poppins.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
