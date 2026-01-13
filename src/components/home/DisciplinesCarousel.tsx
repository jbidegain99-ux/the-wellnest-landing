'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { BrandAssets } from '@/lib/assets'

// Default images as fallback
const DEFAULT_IMAGES = {
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  pilates: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  pole: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=800&q=80',
  sound: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&q=80',
  nutrition: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80',
}

// Base discipline data - Copy exacto del documento Wellnest
const baseDisciplines = [
  {
    id: 'yoga',
    assetKey: 'discipline_yoga_image_url',
    title: 'Yoga',
    shortDescription: 'Encuentra tu balance interior',
    description: 'El yoga es una experiencia de presencia: movimiento consciente, respiración y calma. En cada clase te guiamos con cuidado y técnica para que habites tu cuerpo, sueltes tensión y cultives equilibrio—desde donde estés hoy.',
    href: '/clases#yoga',
    gradient: 'from-[#959D93]/80 to-[#7A9A6D]/80',
    bgColor: 'bg-[#959D93]/10',
    imageAlt: 'Clase de Yoga en The Wellnest',
  },
  {
    id: 'pilates',
    assetKey: 'discipline_pilates_image_url',
    title: 'Pilates Mat',
    shortDescription: 'Fortalece tu centro, estiliza tu postura',
    description: 'Pilates Mat es una práctica en Mat que fortalece el core profundo, mejora la alineación y cultiva un movimiento controlado y elegante. Te guiamos con precisión para que sientas un cuerpo más estable, ligero y armonioso.',
    href: '/clases#pilates',
    gradient: 'from-[#111316]/80 to-[#2A2A2A]/80',
    bgColor: 'bg-[#111316]/10',
    imageAlt: 'Clase de Pilates Mat en The Wellnest',
  },
  {
    id: 'pole',
    assetKey: 'discipline_pole_image_url',
    title: 'Pole Fitness',
    shortDescription: 'Desafía tus límites, empodera tu energía',
    description: 'Pole es fuerza y arte en un mismo movimiento: construyes potencia, control y confianza, mientras exploras tu expresión con elegancia. Te acompañamos paso a paso en un espacio seguro y motivador, para que celebres tu progreso—sin prisa, sin presión.',
    href: '/clases#pole',
    gradient: 'from-[#B0B0B0]/80 to-[#8A8A8A]/80',
    bgColor: 'bg-[#E5E5E5]',
    imageAlt: 'Clase de Pole Fitness en The Wellnest',
  },
  {
    id: 'sound',
    assetKey: 'discipline_sound_image_url',
    title: 'Terapia de Sonido',
    shortDescription: 'Conecta con tu ser interior',
    description: 'La Terapia de Sonido armoniza tu cuerpo a nivel celular, invitándote al descanso y la reconexión. A través de vibraciones, frecuencias y sonido consciente—acompañadas de meditación guiada—tu cuerpo y tu mente sueltan tensión, regulan emociones y regresan a su estado natural de equilibrio.',
    href: '/clases#terapia-de-sonido',
    gradient: 'from-[#482F21]/80 to-[#5D4E42]/80',
    bgColor: 'bg-[#482F21]/10',
    imageAlt: 'Sesión de Terapia de Sonido con cuencos tibetanos',
  },
  {
    id: 'nutrition',
    assetKey: 'discipline_nutrition_image_url',
    title: 'Nutrición',
    shortDescription: 'Cuidamos tu salud',
    description: 'En Wellnest integramos nutrición con nutricionistas especializadas para acompañarte con un enfoque completo: movimiento, hábitos y bienestar en un mismo lugar. Honramos tu estilo de vida, tus necesidades y tu ritmo, para que construyas hábitos reales, sostenibles y con consciencia.',
    href: '/clases#nutricion',
    gradient: 'from-[#B8D4A8]/80 to-[#9AC088]/80',
    bgColor: 'bg-[#B8D4A8]/10',
    imageAlt: 'Consulta de Nutrición en The Wellnest',
  },
]

interface DisciplinesCarouselProps {
  assets?: BrandAssets
}

export function DisciplinesCarousel({ assets }: DisciplinesCarouselProps) {
  // Build disciplines with dynamic images from assets
  const disciplines = baseDisciplines.map((discipline) => ({
    ...discipline,
    imageSrc: assets?.[discipline.assetKey]?.url || DEFAULT_IMAGES[discipline.id as keyof typeof DEFAULT_IMAGES],
  }))
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
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            Explora prácticas cuidadosamente seleccionadas y elige la que mejor acompañe tu ritmo hoy. Con un solo paquete, accede a todas cuando lo desees y vive la experiencia Wellnest con intención, calma y estilo.
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
                <div className="relative h-full min-h-[320px]">
                  {/* Background Image - TODO: subir imágenes reales a estas rutas */}
                  <Image
                    src={discipline.imageSrc}
                    alt={discipline.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 340px"
                    onError={(e) => {
                      // Hide image on error, gradient will show as fallback
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {/* Gradient Overlay */}
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br opacity-80',
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
