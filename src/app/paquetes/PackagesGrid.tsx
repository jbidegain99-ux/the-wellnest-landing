'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Check, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Package {
  id: string
  slug: string | null
  name: string
  subtitle: string | null
  shortDescription: string
  fullDescription: string
  classCount: number
  price: number
  originalPrice: number | null
  discountPercent: number | null
  currency: string
  validityDays: number
  validityText: string | null
  bulletsTop: string[]
  bulletsBottom: string[]
  isFeatured: boolean
}

interface PackagesGridProps {
  packages: Package[]
  colors: string[]
}

export function PackagesGrid({ packages, colors }: PackagesGridProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [isAddingToCart, setIsAddingToCart] = React.useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  // Format price with currency
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price)
  }

  // Format validity text
  const formatValidity = (days: number, text: string | null) => {
    if (text) return text
    if (days === 1) return '1 día de vigencia'
    return `${days} días de vigencia`
  }

  const handleAddToCart = async (pkg: Package) => {
    if (!session) {
      router.push('/login?redirect=/paquetes')
      return
    }

    setIsAddingToCart(pkg.id)

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId: pkg.id }),
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

  if (packages.length === 0) {
    return (
      <section className="py-12 sm:py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12 text-gray-500">
            No hay paquetes disponibles en este momento.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 sm:py-16 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {packages.map((pkg, index) => {
            const isExpanded = expandedId === pkg.id
            const color = colors[index % colors.length]
            const hasDiscount = pkg.originalPrice && pkg.discountPercent

            // Build main features from bulletsTop or defaults
            const mainFeatures = pkg.bulletsTop.length > 0
              ? pkg.bulletsTop
              : [
                  `${pkg.classCount} ${pkg.classCount === 1 ? 'clase' : 'clases'}`,
                  formatValidity(pkg.validityDays, pkg.validityText),
                ]

            // Use bulletsBottom for benefits or fallback to shortDescription split
            const benefits = pkg.bulletsBottom.length > 0
              ? pkg.bulletsBottom
              : [pkg.shortDescription]

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

                {/* Header - sage green solid for apertura, gradient for regular */}
                <div
                  className={`h-20 sm:h-24 flex items-end p-4 sm:p-5 ${
                    hasDiscount
                      ? 'bg-[#6B7F5E]'
                      : `bg-gradient-to-r ${color}`
                  }`}
                >
                  <h3 className="text-lg sm:text-xl font-medium text-white drop-shadow-sm leading-tight">
                    {pkg.name}
                  </h3>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                  {/* Subtitle */}
                  {pkg.subtitle && (
                    <p className="text-gray-500 text-sm mb-3 italic">{pkg.subtitle}</p>
                  )}

                  {/* Price section */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-medium text-foreground">
                        {formatPrice(pkg.price, pkg.currency)}
                      </span>
                      {hasDiscount && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#C4943D] text-white">
                          {pkg.discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    {hasDiscount && pkg.originalPrice && (
                      <p className="text-sm text-gray-400 line-through mt-1">
                        {formatPrice(pkg.originalPrice, pkg.currency)}
                      </p>
                    )}
                  </div>

                  {/* Main features */}
                  <div className="space-y-1.5 mb-4">
                    {mainFeatures.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Full Description */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {pkg.fullDescription}
                  </p>

                  {/* Benefits */}
                  <div className="space-y-1.5 mb-4 flex-1">
                    {benefits.map((benefit, i) => (
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
                        isLoading={isAddingToCart === pkg.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToCart(pkg)
                        }}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
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
      </div>
    </section>
  )
}
