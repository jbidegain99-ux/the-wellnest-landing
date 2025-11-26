'use client'

import * as React from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Sample gallery images
const galleryImages = [
  {
    id: '1',
    url: '/images/gallery/studio-1.jpg',
    alt: 'Vista general del estudio',
    caption: 'Nuestro espacio de práctica principal',
  },
  {
    id: '2',
    url: '/images/gallery/yoga-1.jpg',
    alt: 'Clase de yoga',
    caption: 'Sesión de yoga al amanecer',
  },
  {
    id: '3',
    url: '/images/gallery/pilates-1.jpg',
    alt: 'Clase de pilates',
    caption: 'Pilates Mat en grupo',
  },
  {
    id: '4',
    url: '/images/gallery/pole-1.jpg',
    alt: 'Pole Sport',
    caption: 'Sala de Pole Sport',
  },
  {
    id: '5',
    url: '/images/gallery/soundbath-1.jpg',
    alt: 'Sound Healing',
    caption: 'Preparación para Sound Bath',
  },
  {
    id: '6',
    url: '/images/gallery/studio-2.jpg',
    alt: 'Recepción',
    caption: 'Área de recepción y bienvenida',
  },
  {
    id: '7',
    url: '/images/gallery/studio-3.jpg',
    alt: 'Vestuarios',
    caption: 'Vestuarios equipados',
  },
  {
    id: '8',
    url: '/images/gallery/yoga-2.jpg',
    alt: 'Meditación',
    caption: 'Espacio de meditación',
  },
  {
    id: '9',
    url: '/images/gallery/community-1.jpg',
    alt: 'Comunidad',
    caption: 'Nuestra hermosa comunidad',
  },
]

export default function GaleriaPage() {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    setSelectedIndex(null)
    document.body.style.overflow = 'auto'
  }

  const goToPrevious = () => {
    if (selectedIndex === null) return
    setSelectedIndex(
      selectedIndex === 0 ? galleryImages.length - 1 : selectedIndex - 1
    )
  }

  const goToNext = () => {
    if (selectedIndex === null) return
    setSelectedIndex(
      selectedIndex === galleryImages.length - 1 ? 0 : selectedIndex + 1
    )
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex])

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Galería
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Conoce nuestro espacio diseñado para tu bienestar. Un santuario de
            paz en medio de la ciudad.
          </p>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryImages.map((image, index) => (
              <div
                key={image.id}
                onClick={() => openLightbox(index)}
                className={cn(
                  'relative aspect-square rounded-2xl overflow-hidden cursor-pointer group',
                  index === 0 && 'sm:col-span-2 sm:row-span-2'
                )}
              >
                {/* Placeholder background */}
                <div className="absolute inset-0 bg-gradient-to-br from-beige-dark to-earthTone" />

                {/* Placeholder text */}
                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                  <span className="text-sm">{image.alt}</span>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end">
                  <div className="p-4 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-medium">
                      {image.caption}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Navigation */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronRight className="h-10 w-10" />
          </button>

          {/* Image container */}
          <div className="max-w-5xl max-h-[80vh] mx-4">
            {/* Placeholder for actual image */}
            <div className="w-full h-[60vh] bg-gradient-to-br from-beige-dark to-earthTone rounded-lg flex items-center justify-center text-white/50">
              <div className="text-center">
                <p className="text-lg">{galleryImages[selectedIndex].alt}</p>
                <p className="text-sm mt-2">
                  {galleryImages[selectedIndex].caption}
                </p>
              </div>
            </div>
          </div>

          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {selectedIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}
    </>
  )
}
