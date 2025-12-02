'use client'

import * as React from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

// Gallery images with Unsplash placeholders for wellness studio
const galleryImages = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=800&fit=crop',
    alt: 'Vista general del estudio',
    caption: 'Nuestro espacio de práctica principal',
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=600&fit=crop',
    alt: 'Clase de yoga',
    caption: 'Sesión de yoga al amanecer',
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=600&fit=crop',
    alt: 'Clase de pilates',
    caption: 'Pilates Mat en grupo',
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&h=600&fit=crop',
    alt: 'Pole Sport',
    caption: 'Sala de Pole Sport',
  },
  {
    id: '5',
    url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=600&fit=crop',
    alt: 'Sound Healing',
    caption: 'Preparación para Sound Bath',
  },
  {
    id: '6',
    url: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=600&h=600&fit=crop',
    alt: 'Recepción',
    caption: 'Área de recepción y bienvenida',
  },
  {
    id: '7',
    url: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&h=600&fit=crop',
    alt: 'Vestuarios',
    caption: 'Vestuarios equipados',
  },
  {
    id: '8',
    url: 'https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?w=600&h=600&fit=crop',
    alt: 'Meditación',
    caption: 'Espacio de meditación',
  },
  {
    id: '9',
    url: 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=600&h=600&fit=crop',
    alt: 'Comunidad',
    caption: 'Nuestra hermosa comunidad',
  },
]

export default function GaleriaPage() {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [imageErrors, setImageErrors] = React.useState<Set<string>>(new Set())

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = React.useCallback(() => {
    setSelectedIndex(null)
    document.body.style.overflow = 'auto'
  }, [])

  const goToPrevious = React.useCallback(() => {
    if (selectedIndex === null) return
    setSelectedIndex(
      selectedIndex === 0 ? galleryImages.length - 1 : selectedIndex - 1
    )
  }, [selectedIndex])

  const goToNext = React.useCallback(() => {
    if (selectedIndex === null) return
    setSelectedIndex(
      selectedIndex === galleryImages.length - 1 ? 0 : selectedIndex + 1
    )
  }, [selectedIndex])

  const handleImageError = (imageId: string) => {
    setImageErrors((prev) => new Set(prev).add(imageId))
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
  }, [selectedIndex, closeLightbox, goToPrevious, goToNext])

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
            {galleryImages.map((image, index) => {
              const hasError = imageErrors.has(image.id)

              return (
                <div
                  key={image.id}
                  onClick={() => openLightbox(index)}
                  className={cn(
                    'relative aspect-square rounded-2xl overflow-hidden cursor-pointer group bg-beige',
                    index === 0 && 'sm:col-span-2 sm:row-span-2'
                  )}
                >
                  {hasError ? (
                    // Fallback placeholder when image fails to load
                    <div className="absolute inset-0 bg-gradient-to-br from-[#9CAF88] to-[#C4A77D] flex items-center justify-center">
                      <div className="text-center text-white/80">
                        <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">{image.alt}</p>
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={image.url}
                      alt={image.alt}
                      fill
                      sizes={index === 0 ? '(max-width: 640px) 100vw, 66vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={() => handleImageError(image.id)}
                    />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end">
                    <div className="p-4 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-white text-sm font-medium">
                        {image.caption}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info note */}
          <div className="mt-12 text-center">
            <p className="text-gray-600">
              Haz clic en cualquier imagen para verla en tamaño completo
            </p>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
            aria-label="Cerrar"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Navigation */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors z-10"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
            aria-label="Imagen siguiente"
          >
            <ChevronRight className="h-10 w-10" />
          </button>

          {/* Image container */}
          <div className="relative w-full max-w-5xl max-h-[80vh] mx-4 aspect-video">
            {imageErrors.has(galleryImages[selectedIndex].id) ? (
              <div className="w-full h-full bg-gradient-to-br from-[#9CAF88] to-[#C4A77D] rounded-lg flex items-center justify-center text-white">
                <div className="text-center">
                  <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{galleryImages[selectedIndex].alt}</p>
                  <p className="text-sm mt-2 opacity-75">
                    {galleryImages[selectedIndex].caption}
                  </p>
                </div>
              </div>
            ) : (
              <Image
                src={galleryImages[selectedIndex].url}
                alt={galleryImages[selectedIndex].alt}
                fill
                sizes="100vw"
                className="object-contain rounded-lg"
                priority
                onError={() => handleImageError(galleryImages[selectedIndex].id)}
              />
            )}
          </div>

          {/* Caption */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center max-w-md px-4">
            <p className="text-white font-medium">
              {galleryImages[selectedIndex].caption}
            </p>
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
