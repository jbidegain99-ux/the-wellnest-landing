'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Check, ShoppingCart, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

interface Package {
  id: string
  name: string
  shortDescription: string
  fullDescription: string
  classCount: number
  price: number
  validityDays: number
  isFeatured?: boolean
  isActive?: boolean
}

const packageColors = [
  'from-[#E8E0D4] to-[#F5F0E8]',
  'from-[#C4A77D] to-[#E8E0D4]',
  'from-[#9CAF88] to-[#C4A77D]',
  'from-[#8B7355] to-[#9CAF88]',
  'from-[#6B7F5E] to-[#8B7355]',
  'from-[#9CAF88] to-[#6B7F5E]',
]

export default function PaquetesPage() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [packages, setPackages] = React.useState<Package[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isAddingToCart, setIsAddingToCart] = React.useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch('/api/packages')
        if (response.ok) {
          const data = await response.json()
          setPackages(data)
        }
      } catch (error) {
        console.error('Error fetching packages:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const handleAddToCart = async (packageId: string) => {
    if (!session) {
      router.push('/login?redirect=/paquetes')
      return
    }

    setIsAddingToCart(packageId)

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId }),
      })

      if (response.ok) {
        router.push('/carrito')
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
    } finally {
      setIsAddingToCart(null)
    }
  }

  if (isLoading) {
    return (
      <>
        <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
              Paquetes de Clases
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Elige el paquete que mejor se adapte a ti. Recuerda: puedes usar tus
              clases en <span className="text-primary font-medium">cualquier disciplina</span>.
            </p>
          </div>
        </section>
        <section className="py-16 bg-cream">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Paquetes de Clases
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Elige el paquete que mejor se adapte a ti. Recuerda: puedes usar tus
            clases en <span className="text-primary font-medium">cualquier disciplina</span>.
          </p>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {packages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No hay paquetes disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {packages.map((pkg, index) => {
                const isExpanded = expandedId === pkg.id
                const isUnlimited = pkg.classCount >= 999
                const pricePerClass = isUnlimited ? null : pkg.price / pkg.classCount
                const color = packageColors[index % packageColors.length]

                return (
                  <div
                    key={pkg.id}
                    className={`relative bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer w-full ${
                      isExpanded ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                  >
                    {/* Featured badge */}
                    {pkg.isFeatured && (
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
                        <Badge variant="default">Más Popular</Badge>
                      </div>
                    )}

                    {/* Header with gradient */}
                    <div
                      className={`h-20 sm:h-24 bg-gradient-to-r ${color} flex items-end p-4 sm:p-6`}
                    >
                      <h3 className="font-serif text-xl sm:text-2xl font-semibold text-white drop-shadow-sm">
                        {pkg.name}
                      </h3>
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-6">
                      <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4">{pkg.shortDescription}</p>

                      <div className="flex items-baseline gap-1 mb-1 sm:mb-2">
                        <span className="font-serif text-3xl sm:text-4xl font-semibold text-foreground">
                          {formatPrice(pkg.price)}
                        </span>
                      </div>

                      {pricePerClass && (
                        <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                          {formatPrice(pricePerClass)} por clase
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                        <span className="flex items-center gap-1">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          {isUnlimited ? 'Ilimitadas' : `${pkg.classCount} clases`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          {pkg.validityDays} días
                        </span>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="pt-4 border-t border-beige animate-slide-down">
                          <p className="text-gray-600 mb-4">{pkg.fullDescription}</p>

                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary" />
                              <span>Válido para todas las disciplinas</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary" />
                              <span>Reserva desde la app</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary" />
                              <span>Cancela hasta 4 horas antes</span>
                            </div>
                          </div>

                          <Button
                            className="w-full"
                            isLoading={isAddingToCart === pkg.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToCart(pkg.id)
                            }}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Agregar al carrito
                          </Button>
                        </div>
                      )}

                      {/* Click hint */}
                      {!isExpanded && (
                        <button className="flex items-center gap-1 text-sm text-primary hover:underline mt-2">
                          <Info className="h-4 w-4" />
                          Ver detalles
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Info note */}
          <div className="mt-12 p-6 bg-white rounded-2xl border border-beige">
            <h3 className="font-serif text-xl font-semibold text-foreground mb-3">
              ¿Cómo funcionan los paquetes?
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Flexibilidad total:</strong> Usa tus clases en cualquier
                  disciplina (Yoga, Pilates, Pole Fitness, Terapia de Sonido).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Vigencia clara:</strong> Cada paquete tiene una vigencia
                  específica desde la fecha de compra.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Fácil de usar:</strong> Reserva desde tu perfil y presenta
                  tu código QR al llegar al estudio.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Nota:</strong> Las consultas de nutrición requieren pago
                  adicional y no están incluidas en los paquetes de clases.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
