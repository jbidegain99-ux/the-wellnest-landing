'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Instagram, Facebook, Mail, Phone, MapPin } from 'lucide-react'

const navigation = {
  disciplinas: [
    { name: 'Yoga', href: '/clases#yoga' },
    { name: 'Pilates Mat', href: '/clases#pilates' },
    { name: 'Pole Sport', href: '/clases#pole' },
    { name: 'Sound Healing', href: '/clases#soundhealing' },
    { name: 'Nutrición', href: '/clases#nutricion' },
  ],
  estudio: [
    { name: 'Paquetes', href: '/paquetes' },
    { name: 'Horarios', href: '/horarios' },
    { name: 'Equipo', href: '/equipo' },
    { name: 'Galería', href: '/galeria' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Términos y Condiciones', href: '/terminos' },
    { name: 'Política de Privacidad', href: '/privacidad' },
    { name: 'Política de Cancelación', href: '/cancelacion' },
  ],
}

const socialLinks = [
  { name: 'Instagram', href: 'https://instagram.com/thewellnest', icon: Instagram },
  { name: 'Facebook', href: 'https://facebook.com/thewellnest', icon: Facebook },
]

export function Footer() {
  const pathname = usePathname()

  // Don't show footer on admin routes
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <footer className="bg-beige">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <span className="font-logo text-3xl font-light tracking-[0.1em] text-[#453C34]">
                wellnest.
              </span>
            </Link>
            <p className="mt-2 text-xs font-medium tracking-[0.25em] text-[#453C34]/60 uppercase">
              The Soul Hub
            </p>
            <p className="mt-4 text-gray-600 max-w-sm">
              Donde cuerpo, mente y energía se reencuentran. Tu santuario de bienestar integral en El Salvador.
            </p>
            <div className="mt-6 flex space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white text-gray-600 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{social.name}</span>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Disciplinas */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-4">
              Disciplinas
            </h3>
            <ul className="space-y-3">
              {navigation.disciplinas.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-600 hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Estudio */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-4">
              Estudio
            </h3>
            <ul className="space-y-3">
              {navigation.estudio.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-600 hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-4">
              Contacto
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-2">
                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span>San Salvador, El Salvador</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-5 w-5 flex-shrink-0" />
                <a href="tel:+50312345678" className="hover:text-primary transition-colors">
                  +503 1234 5678
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-5 w-5 flex-shrink-0" />
                <a href="mailto:hola@thewellnest.sv" className="hover:text-primary transition-colors">
                  hola@thewellnest.sv
                </a>
              </li>
            </ul>

          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-beige-dark">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} wellnest. Todos los derechos reservados.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              {navigation.legal.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-600 hover:text-primary transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
