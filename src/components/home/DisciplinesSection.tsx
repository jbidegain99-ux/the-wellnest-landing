'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const disciplines = [
  {
    id: 'yoga',
    name: 'Yoga',
    description: 'Encuentra tu equilibrio interior a través de posturas, respiración y meditación. Una práctica milenaria que une cuerpo, mente y espíritu.',
    href: '/clases#yoga',
    image: '/images/yoga.jpg',
    gradient: 'from-[#9CAF88] to-[#6B7F5E]',
  },
  {
    id: 'pilates',
    name: 'Pilates Mat',
    description: 'Fortalece tu core y mejora tu postura con ejercicios de bajo impacto. Transforma tu cuerpo con precisión y control.',
    href: '/clases#pilates',
    image: '/images/pilates.jpg',
    gradient: 'from-[#C4A77D] to-[#8B7355]',
  },
  {
    id: 'pole',
    name: 'Pole Sport',
    description: 'Desafía tu fuerza y flexibilidad en un ambiente empoderador. Descubre tu potencial y construye confianza.',
    href: '/clases#pole',
    image: '/images/pole.jpg',
    gradient: 'from-[#D4A5A5] to-[#9E7676]',
  },
  {
    id: 'soundhealing',
    name: 'Sound Healing',
    description: 'Sumérgete en frecuencias sanadoras para una relajación profunda. Experimenta el poder transformador del sonido.',
    href: '/clases#soundhealing',
    image: '/images/soundhealing.jpg',
    gradient: 'from-[#A8C5DA] to-[#6B8E9E]',
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    description: 'Consultas personalizadas para nutrir tu cuerpo desde adentro. Crea hábitos sostenibles para tu bienestar.',
    href: '/clases#nutricion',
    image: '/images/nutricion.jpg',
    gradient: 'from-[#B8D4A8] to-[#7EA66B]',
  },
]

export function DisciplinesSection() {
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const selectedDiscipline = disciplines[selectedIndex]

  return (
    <section className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">
            Nuestras Disciplinas
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Explora nuestras diferentes prácticas y encuentra la que mejor se adapte
            a tu momento. Con un solo paquete, accede a todas.
          </p>
        </div>

        {/* Desktop: Vertical Bars Design */}
        <div className="hidden lg:block">
          <div className="flex h-[500px] gap-2 rounded-2xl overflow-hidden">
            {disciplines.map((discipline, index) => (
              <button
                key={discipline.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative h-full transition-all duration-500 ease-in-out overflow-hidden group',
                  selectedIndex === index ? 'flex-[3]' : 'flex-1'
                )}
              >
                {/* Background gradient (placeholder for image) */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br',
                  discipline.gradient
                )}>
                  <div className={cn(
                    'absolute inset-0 bg-black/40 transition-opacity duration-300',
                    selectedIndex === index ? 'opacity-30' : 'opacity-50 group-hover:opacity-40'
                  )} />
                </div>

                {/* Vertical name (shown when not selected) */}
                <div className={cn(
                  'absolute inset-0 flex items-center justify-center transition-opacity duration-300',
                  selectedIndex === index ? 'opacity-0' : 'opacity-100'
                )}>
                  <span
                    className="text-white font-serif text-2xl font-semibold tracking-wider"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    {discipline.name}
                  </span>
                </div>

                {/* Expanded content (shown when selected) */}
                <div className={cn(
                  'absolute inset-0 flex flex-col justify-end p-8 transition-opacity duration-500',
                  selectedIndex === index ? 'opacity-100' : 'opacity-0'
                )}>
                  <div className="text-left text-white">
                    <h3 className="font-serif text-4xl font-semibold mb-4">
                      {discipline.name}
                    </h3>
                    <p className="text-white/90 text-lg mb-6 max-w-md">
                      {discipline.description}
                    </p>
                    <Link href={discipline.href}>
                      <Button
                        variant="outline"
                        className="border-white text-white hover:bg-white hover:text-foreground"
                      >
                        Conocer más
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Indicator dots */}
          <div className="flex justify-center gap-2 mt-6">
            {disciplines.map((_, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  selectedIndex === index
                    ? 'bg-primary w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                )}
              />
            ))}
          </div>
        </div>

        {/* Mobile: Card Grid */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {disciplines.map((discipline) => (
            <Link key={discipline.id} href={discipline.href}>
              <div className={cn(
                'relative h-48 rounded-xl overflow-hidden group cursor-pointer'
              )}>
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br',
                  discipline.gradient
                )}>
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
                </div>
                <div className="relative h-full flex flex-col justify-end p-6 text-white">
                  <h3 className="font-serif text-2xl font-semibold mb-2">
                    {discipline.name}
                  </h3>
                  <p className="text-white/80 text-sm line-clamp-2">
                    {discipline.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/clases">
            <Button variant="outline" size="lg">
              Conoce más sobre nuestras clases
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
