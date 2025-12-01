'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Discipline data with descriptions
const disciplines = [
  {
    id: 'yoga',
    title: 'Yoga',
    shortDescription: 'Encuentra tu equilibrio interior a través de posturas, respiración y meditación.',
    description: 'Encuentra tu equilibrio interior a través de posturas, respiración y meditación. Una práctica milenaria que une cuerpo, mente y espíritu.',
    href: '/clases#yoga',
    gradient: 'from-[#9CAF88] to-[#7A9A6D]',
    bgColor: 'bg-[#9CAF88]/10',
  },
  {
    id: 'pilates',
    title: 'Pilates Mat',
    shortDescription: 'Fortalece tu centro, mejora tu postura y cuida tus articulaciones con movimientos controlados.',
    description: 'Fortalece tu centro, mejora tu postura y cuida tus articulaciones a través de secuencias conscientes en mat, enfocadas en respiración y alineación.',
    href: '/clases#pilates',
    gradient: 'from-[#C4A77D] to-[#A88B5C]',
    bgColor: 'bg-[#C4A77D]/10',
  },
  {
    id: 'pole',
    title: 'Pole Sport',
    shortDescription: 'Empodérate, conecta con tu fuerza y tu sensualidad en un entorno seguro.',
    description: 'Empodérate, conecta con tu fuerza y tu sensualidad en un entorno seguro y acompañado, combinando fuerza, flexibilidad y expresión corporal.',
    href: '/clases#pole',
    gradient: 'from-[#D4A5A5] to-[#B88888]',
    bgColor: 'bg-[#D4A5A5]/10',
  },
  {
    id: 'sound',
    title: 'Sound Healing',
    shortDescription: 'Relaja tu sistema nervioso a través de baños de sonido y frecuencias terapéuticas.',
    description: 'Relaja tu sistema nervioso, libera tensión y entra en estados profundos de descanso mediante baños de sonido con cuencos, gongs y otras frecuencias terapéuticas.',
    href: '/clases#soundhealing',
    gradient: 'from-[#A8C5DA] to-[#8AAFC8]',
    bgColor: 'bg-[#A8C5DA]/10',
  },
  {
    id: 'nutrition',
    title: 'Nutrición',
    shortDescription: 'Acompañamiento nutricional desde un enfoque integral y consciente.',
    description: 'Acompañamiento nutricional desde un enfoque integral, funcional y consciente para equilibrar energía, hormonas y bienestar general.',
    href: '/clases#nutricion',
    gradient: 'from-[#B8D4A8] to-[#9AC088]',
    bgColor: 'bg-[#B8D4A8]/10',
  },
]

export function DisciplinesCarousel() {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(true)

  // Check scroll position to update arrow states
  const updateScrollButtons = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }, [])

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    updateScrollButtons()
    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)

    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [updateScrollButtons])

  // Scroll navigation
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const cardWidth = container.querySelector('.discipline-card')?.clientWidth || 300
    const scrollAmount = cardWidth + 24 // card width + gap

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // Handle card expansion (for mobile tap)
  const toggleCard = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleCard(id)
    }
  }

  return (
    <section className="py-24 bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">
            Nuestras Disciplinas
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Explora nuestras diferentes prácticas y encuentra la que mejor se adapte
            a tu momento. Con un solo paquete, accede a todas.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Left Arrow */}
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Ver disciplina anterior"
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden lg:flex',
              'w-12 h-12 items-center justify-center rounded-full',
              'bg-white shadow-lg border border-gray-100',
              'transition-all duration-200',
              canScrollLeft
                ? 'opacity-100 hover:bg-beige hover:scale-105 cursor-pointer'
                : 'opacity-0 cursor-default'
            )}
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Ver siguiente disciplina"
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden lg:flex',
              'w-12 h-12 items-center justify-center rounded-full',
              'bg-white shadow-lg border border-gray-100',
              'transition-all duration-200',
              canScrollRight
                ? 'opacity-100 hover:bg-beige hover:scale-105 cursor-pointer'
                : 'opacity-0 cursor-default'
            )}
          >
            <ChevronRight className="w-6 h-6 text-foreground" />
          </button>

          {/* Scrollable Cards Container */}
          <div
            ref={scrollContainerRef}
            className={cn(
              'flex gap-6 overflow-x-auto scroll-smooth',
              'px-4 lg:px-14 py-4',
              'snap-x snap-mandatory',
              // Hide scrollbar but keep functionality
              'scrollbar-hide',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            {disciplines.map((discipline) => (
              <div
                key={discipline.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleCard(discipline.id)}
                onKeyDown={(e) => handleKeyDown(e, discipline.id)}
                className={cn(
                  'discipline-card group flex-shrink-0 snap-center',
                  'w-[280px] sm:w-[320px] lg:w-[340px]',
                  'rounded-2xl overflow-hidden cursor-pointer',
                  'transition-all duration-300 ease-out',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  // Hover/active state - subtle expansion
                  'lg:hover:scale-[1.03] lg:hover:shadow-xl',
                  expandedId === discipline.id && 'scale-[1.03] shadow-xl'
                )}
              >
                {/* Card Content */}
                <div className="relative h-full">
                  {/* Gradient Background */}
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br opacity-90',
                      discipline.gradient
                    )}
                  />

                  {/* Content Wrapper */}
                  <div className="relative h-full flex flex-col p-6 text-white">
                    {/* Title - Always visible */}
                    <div className="min-h-[200px] flex flex-col justify-end">
                      <h3 className="font-serif text-3xl font-semibold mb-3">
                        {discipline.title}
                      </h3>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {discipline.shortDescription}
                      </p>
                    </div>

                    {/* Expanded Content - Description + CTA */}
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-300 ease-out',
                        // Desktop: show on hover, Mobile: show on tap
                        'lg:max-h-0 lg:opacity-0 lg:group-hover:max-h-40 lg:group-hover:opacity-100',
                        expandedId === discipline.id
                          ? 'max-h-40 opacity-100 mt-4'
                          : 'max-h-0 opacity-0 lg:group-hover:mt-4'
                      )}
                    >
                      <p className="text-white/90 text-sm mb-4 leading-relaxed">
                        {discipline.description}
                      </p>
                      <Link
                        href={discipline.href}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white text-white hover:bg-white hover:text-foreground transition-colors"
                        >
                          Conocer más
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Scroll Indicator Dots */}
          <div className="flex justify-center gap-2 mt-6 lg:hidden">
            {disciplines.map((discipline, index) => (
              <button
                key={discipline.id}
                onClick={() => {
                  const container = scrollContainerRef.current
                  if (!container) return
                  const cards = container.querySelectorAll('.discipline-card')
                  if (cards[index]) {
                    cards[index].scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'center',
                    })
                  }
                }}
                aria-label={`Ir a ${discipline.title}`}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  expandedId === discipline.id
                    ? 'bg-primary w-6'
                    : 'bg-gray-300 hover:bg-gray-400'
                )}
              />
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center mt-12">
          <Link href="/clases">
            <Button variant="outline" size="lg">
              Descubre todas nuestras clases
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
