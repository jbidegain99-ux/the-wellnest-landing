'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Check, ShoppingCart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// Paquetes con contenido exacto según especificación
const packagesData = [
  {
    id: 'drop-in',
    name: 'Drop-In Class',
    subtitle: 'Ideal para fluir a tu propio ritmo',
    price: '$10.00',
    mainFeatures: ['1 clase', '5 días de vigencia'],
    description: 'Perfecta para regalarte un momento consciente, probar una disciplina o adaptarte a semanas con horarios cambiantes.',
    benefits: [
      'Válida para todas las disciplinas',
      'Reserva desde la app',
      'Cancela tu clase 8 horas antes',
    ],
  },
  {
    id: 'mini-flow',
    name: 'Mini Flow (4 clases)',
    subtitle: 'Una pausa semanal para reconectar',
    price: '$49.99',
    mainFeatures: ['4 clases', '30 días de vigencia'],
    description: 'Un paquete suave y accesible para iniciar tu camino de bienestar, crear constancia y sentir el movimiento como medicina.',
    benefits: [
      'Ideal para comenzar',
      'Todas las disciplinas incluidas',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
  },
  {
    id: 'balance-pass',
    name: 'Balance Pass (8 clases)',
    subtitle: 'Encuentra tu ritmo y sosténlo',
    price: '$69.99',
    mainFeatures: ['8 clases', '30 días de vigencia'],
    description: 'Diseñado para quienes desean integrar el movimiento consciente como parte de su semana y equilibrar cuerpo y mente.',
    benefits: [
      'Dos veces por semana',
      'Acceso a todas las disciplinas',
      'Flexibilidad total de horarios',
      'Cancela tu clase 8 horas antes',
    ],
    isFeatured: true,
  },
  {
    id: 'energia-total',
    name: 'Energía Total (12 clases)',
    subtitle: 'Movimiento constante, energía en expansión',
    price: '$95.00',
    mainFeatures: ['12 clases', '30 días de vigencia'],
    description: 'Un impulso energético para quienes buscan mayor presencia, fuerza y conexión interior a través del movimiento regular.',
    benefits: [
      'Ideal para crear hábito',
      'Todas las disciplinas incluidas',
      'Reserva desde la app',
      'Cancela tu clase 8 horas antes',
    ],
  },
  {
    id: 'vital-plan',
    name: 'Vital Plan (16 clases)',
    subtitle: 'Tu bienestar como prioridad',
    price: '$115.00',
    mainFeatures: ['16 clases', '30 días de vigencia'],
    description: 'Pensado para quienes eligen sostener su bienestar con intención, constancia y variedad de disciplinas.',
    benefits: [
      'Hasta 4 clases por semana',
      'Movimiento consciente y flexible',
      'Acompaña tu ritmo de vida',
      'Cancela tu clase 8 horas antes',
    ],
  },
  {
    id: 'full-access',
    name: 'Full Access (24 clases)',
    subtitle: 'Compromiso profundo con tu bienestar',
    price: '$145.00',
    mainFeatures: ['24 clases', '35 días de vigencia'],
    description: 'Nuestro plan más completo para quienes desean integrar el movimiento como un estilo de vida consciente y presente en día a día.',
    benefits: [
      'Máxima flexibilidad',
      'Acceso total a disciplinas',
      'Ideal para rutinas activas',
      'Cancela tu clase 8 horas antes',
    ],
  },
  {
    id: 'wellnest-trimestral',
    name: 'Wellnest Trimestral (80 clases)',
    subtitle: 'Una experiencia integral de bienestar',
    price: '$355.00',
    mainFeatures: ['80 clases', 'Vigencia trimestral'],
    description: 'Diseñado para quienes desean una transformación profunda, sostenida y consciente durante todo el trimestre.',
    benefits: [
      'Acceso ilimitado a disciplinas',
      'Ideal para práctica constante',
      'La mejor inversión en tu bienestar',
      'Cancela tu clase 8 horas antes',
    ],
  },
]

const packageColors = [
  'from-[#E8E0D4] to-[#F5F0E8]',
  'from-[#C4A77D] to-[#E8E0D4]',
  'from-[#9CAF88] to-[#C4A77D]',
  'from-[#8B7355] to-[#9CAF88]',
  'from-[#6B7F5E] to-[#8B7355]',
  'from-[#9CAF88] to-[#6B7F5E]',
  'from-[#6A6F4C] to-[#806044]',
]

export default function PaquetesPage() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [dbPackages, setDbPackages] = React.useState<Record<string, string>>({})
  const [isLoadingDb, setIsLoadingDb] = React.useState(true)
  const [isAddingToCart, setIsAddingToCart] = React.useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  // Fetch database packages to map IDs for cart functionality
  React.useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch('/api/packages')
        if (response.ok) {
          const data = await response.json()
          // Create a map of package names to IDs
          const pkgMap: Record<string, string> = {}
          data.forEach((pkg: { id: string; name: string }) => {
            pkgMap[pkg.name.toLowerCase()] = pkg.id
          })
          setDbPackages(pkgMap)
        }
      } catch (error) {
        console.error('Error fetching packages:', error)
      } finally {
        setIsLoadingDb(false)
      }
    }
    fetchPackages()
  }, [])

  const handleAddToCart = async (packageName: string) => {
    if (!session) {
      router.push('/login?redirect=/paquetes')
      return
    }

    // Find the database package ID
    const packageId = dbPackages[packageName.toLowerCase()]
    if (!packageId) {
      console.error('Package not found in database')
      return
    }

    setIsAddingToCart(packageName)

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

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-foreground mb-6">
            Paquetes de Clases · The Wellnest
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Elige el paquete que mejor se adapte a ti. Recuerda: puedes usar tus
            clases en <span className="text-primary font-medium">cualquier disciplina</span>.
          </p>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="py-12 sm:py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {packagesData.map((pkg, index) => {
              const isExpanded = expandedId === pkg.id
              const color = packageColors[index % packageColors.length]

              return (
                <div
                  key={pkg.id}
                  className={`relative bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer w-full flex flex-col ${
                    isExpanded ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                >
                  {/* Featured badge */}
                  {pkg.isFeatured && (
                    <div className="absolute top-3 right-3 z-10">
                      <Badge variant="default">Más Popular</Badge>
                    </div>
                  )}

                  {/* Header with gradient */}
                  <div
                    className={`h-20 sm:h-24 bg-gradient-to-r ${color} flex items-end p-4 sm:p-5`}
                  >
                    <h3 className="text-lg sm:text-xl font-medium text-white drop-shadow-sm leading-tight">
                      {pkg.name}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    {/* Subtitle */}
                    <p className="text-gray-500 text-sm mb-3 italic">{pkg.subtitle}</p>

                    {/* Price */}
                    <div className="mb-3">
                      <span className="text-3xl sm:text-4xl font-medium text-foreground">
                        {pkg.price}
                      </span>
                    </div>

                    {/* Main features */}
                    <div className="space-y-1.5 mb-4">
                      {pkg.mainFeatures.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      {pkg.description}
                    </p>

                    {/* Benefits */}
                    <div className="space-y-1.5 mb-4 flex-1">
                      {pkg.benefits.map((benefit, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button - only show when expanded or on larger cards */}
                    {isExpanded && (
                      <div className="pt-4 border-t border-beige animate-slide-down">
                        <Button
                          className="w-full"
                          isLoading={isAddingToCart === pkg.name}
                          disabled={isLoadingDb}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddToCart(pkg.name)
                          }}
                        >
                          {isLoadingDb ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShoppingCart className="mr-2 h-4 w-4" />
                          )}
                          Agregar al carrito
                        </Button>
                      </div>
                    )}

                    {/* Click hint */}
                    {!isExpanded && (
                      <button className="text-sm text-primary hover:underline mt-auto pt-2">
                        Tap para comprar →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info note */}
          <div className="mt-12 p-6 bg-white rounded-2xl border border-beige">
            <h3 className="text-xl font-medium text-foreground mb-4">
              ¿Cómo funcionan los paquetes?
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="font-medium">Flexibilidad total:</strong> Usa tus clases en cualquier
                  disciplina (Yoga, Mat Pilates, Pole Fitness, Terapia de Sonido).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="font-medium">Vigencia clara:</strong> Cada paquete tiene una vigencia
                  específica desde la fecha de compra.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="font-medium">Fácil de usar:</strong> Reserva desde tu perfil y presenta
                  tu código QR al llegar al estudio.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="font-medium">Nota:</strong> Las consultas de nutrición requieren pago
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
