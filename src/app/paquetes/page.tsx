'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Check, ShoppingCart, X, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

const packages = [
  {
    id: '1',
    name: '1 Clase',
    shortDescription: 'Ideal para probar',
    fullDescription:
      'Perfecto para conocer nuestro estudio o para quienes tienen horarios muy flexibles. Una clase para disfrutar cuando quieras.',
    classCount: 1,
    price: 15,
    validityDays: 30,
    color: 'from-[#E8E0D4] to-[#F5F0E8]',
  },
  {
    id: '2',
    name: '4 Clases',
    shortDescription: 'Una vez por semana',
    fullDescription:
      'El paquete perfecto para mantener una práctica semanal constante. Ideal para quienes están iniciando su viaje de bienestar.',
    classCount: 4,
    price: 50,
    validityDays: 45,
    color: 'from-[#C4A77D] to-[#E8E0D4]',
  },
  {
    id: '3',
    name: '8 Clases',
    shortDescription: 'Dos veces por semana',
    fullDescription:
      'Duplica tu práctica y acelera tus resultados. Perfecto para quienes quieren profundizar en su bienestar con mayor frecuencia.',
    classCount: 8,
    price: 90,
    validityDays: 60,
    isFeatured: true,
    color: 'from-[#9CAF88] to-[#C4A77D]',
  },
  {
    id: '4',
    name: '12 Clases',
    shortDescription: 'Tres veces por semana',
    fullDescription:
      'Para los comprometidos con su bienestar. Máxima flexibilidad para combinar diferentes disciplinas cada semana.',
    classCount: 12,
    price: 120,
    validityDays: 60,
    color: 'from-[#8B7355] to-[#9CAF88]',
  },
  {
    id: '5',
    name: '20 Clases',
    shortDescription: 'Práctica intensiva',
    fullDescription:
      'El paquete más completo para una transformación real. Incluye acceso a todas las disciplinas sin restricciones.',
    classCount: 20,
    price: 180,
    validityDays: 90,
    color: 'from-[#6B7F5E] to-[#8B7355]',
  },
  {
    id: '6',
    name: 'Mensual Ilimitado',
    shortDescription: 'Sin límites',
    fullDescription:
      'Clases ilimitadas durante un mes completo. La libertad total para asistir cuando quieras, a la disciplina que quieras.',
    classCount: 999,
    price: 150,
    validityDays: 30,
    isUnlimited: true,
    color: 'from-[#9CAF88] to-[#6B7F5E]',
  },
]

export default function PaquetesPage() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  const handleAddToCart = (packageId: string) => {
    if (!session) {
      router.push('/login?redirect=/paquetes')
      return
    }
    // Add to cart logic here
    router.push('/carrito')
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const isExpanded = expandedId === pkg.id
              const pricePerClass =
                pkg.isUnlimited ? null : pkg.price / pkg.classCount

              return (
                <div
                  key={pkg.id}
                  className={`relative bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer ${
                    isExpanded ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                >
                  {/* Featured badge */}
                  {pkg.isFeatured && (
                    <div className="absolute top-4 right-4 z-10">
                      <Badge variant="default">Más Popular</Badge>
                    </div>
                  )}

                  {/* Header with gradient */}
                  <div
                    className={`h-24 bg-gradient-to-r ${pkg.color} flex items-end p-6`}
                  >
                    <h3 className="font-serif text-2xl font-semibold text-white drop-shadow-sm">
                      {pkg.name}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <p className="text-gray-600 mb-4">{pkg.shortDescription}</p>

                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="font-serif text-4xl font-semibold text-foreground">
                        {formatPrice(pkg.price)}
                      </span>
                    </div>

                    {pricePerClass && (
                      <p className="text-sm text-gray-500 mb-4">
                        {formatPrice(pricePerClass)} por clase
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-primary" />
                        {pkg.isUnlimited ? 'Ilimitadas' : `${pkg.classCount} clases`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-primary" />
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
                  disciplina (Yoga, Pilates, Pole, Sound Healing).
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
