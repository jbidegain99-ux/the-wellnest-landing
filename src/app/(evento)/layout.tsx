import { Cinzel, Cormorant_Garamond, Playfair_Display } from 'next/font/google'
import './evento.css'

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
})

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cinzel.variable} ${cormorant.variable} ${playfair.variable} ev-root min-h-screen`}>
      <div className="relative mx-auto min-h-screen max-w-[440px] overflow-hidden">{children}</div>
    </div>
  )
}
