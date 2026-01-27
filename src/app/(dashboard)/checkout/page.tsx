'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CreditCard, Lock, Check, ArrowLeft, AlertCircle, Loader2, TestTube2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

interface CartItem {
  id: string
  packageId: string
  name: string
  classCount: number
  price: number
  quantity: number
}

interface CheckoutSummary {
  items: CartItem[]
  subtotal: number
  total: number
  isLoggedIn: boolean
  testMode: boolean
}

interface AppliedDiscount {
  code: string
  percentage: number
}

interface PurchaseResult {
  id: string
  packageName: string
  classesRemaining: number
  expiresAt: string
  finalPrice: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isComplete, setIsComplete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [checkoutData, setCheckoutData] = React.useState<CheckoutSummary | null>(null)
  const [appliedDiscount, setAppliedDiscount] = React.useState<AppliedDiscount | null>(null)
  const [purchases, setPurchases] = React.useState<PurchaseResult[]>([])

  // Fetch checkout summary on mount
  React.useEffect(() => {
    const fetchCheckoutData = async () => {
      try {
        const response = await fetch('/api/checkout')
        if (response.ok) {
          const data = await response.json()
          setCheckoutData(data)
        }

        // Get discount from sessionStorage (set by cart page)
        try {
          const savedDiscount = sessionStorage.getItem('cartDiscount')
          if (savedDiscount) {
            const parsed = JSON.parse(savedDiscount)
            if (parsed && parsed.code && parsed.percentage) {
              setAppliedDiscount(parsed)
            }
          }
        } catch (storageError) {
          console.error('[CHECKOUT] Error reading discount from storage:', storageError)
        }
      } catch (err) {
        console.error('Error fetching checkout data:', err)
        setError('Error al cargar los datos del carrito')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCheckoutData()
  }, [])

  // Calculate totals with discount
  const subtotal = checkoutData?.subtotal || 0
  const discountAmount = appliedDiscount
    ? (subtotal * appliedDiscount.percentage) / 100
    : 0
  const total = subtotal - discountAmount

  // Determine if this is a free order (100% discount)
  const isFreeOrder = total === 0 && subtotal > 0

  // Show simplified form for test mode OR free orders
  const showSimplifiedForm = checkoutData?.testMode || isFreeOrder

  console.log('[CHECKOUT] State:', {
    subtotal,
    discountAmount,
    total,
    isFreeOrder,
    testMode: checkoutData?.testMode,
    discountCode: appliedDiscount?.code
  })

  // Auto-redirect to mis-paquetes after success
  React.useEffect(() => {
    if (isComplete) {
      console.log('[CHECKOUT] Purchase complete! Redirecting in 5 seconds...')
      const timer = setTimeout(() => {
        router.push('/perfil/paquetes')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isComplete, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)

    console.log('[CHECKOUT] Submitting order:', {
      discountCode: appliedDiscount?.code,
      total,
      isFreeOrder,
    })

    try {
      // For free orders, use the old checkout flow
      if (isFreeOrder) {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discountCode: appliedDiscount?.code,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          console.log('[CHECKOUT] Free order success!')
          setPurchases(data.purchases || [])
          setIsComplete(true)
          sessionStorage.removeItem('cartDiscount')
        } else {
          setError(data.error || 'Error al procesar la orden')
        }
        return
      }

      // For paid orders, create Order and redirect to PayWay
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountCode: appliedDiscount?.code,
          paymentMethod: 'payway',
        }),
      })

      const data = await response.json()

      console.log('[CHECKOUT] Order response:', {
        ok: response.ok,
        status: response.status,
        data
      })

      if (response.ok && data.order?.id) {
        console.log('[CHECKOUT] Order created, redirecting to PayWay:', data.order.id)
        // Clear discount from sessionStorage
        sessionStorage.removeItem('cartDiscount')
        // Redirect to PayWay checkout
        router.push(`/checkout/payway/${data.order.id}`)
      } else {
        console.error('[CHECKOUT] Error:', data.error)
        setError(data.error || 'Error al crear la orden')
      }
    } catch (err) {
      console.error('[CHECKOUT] Network error:', err)
      setError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Show loading state
  if (isLoading || status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-[var(--color-warning)] mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Inicia sesión para continuar
        </h1>
        <p className="text-gray-600 mb-8">
          Debes iniciar sesión para completar tu compra.
        </p>
        <Link href="/login?redirect=/checkout">
          <Button>Iniciar Sesión</Button>
        </Link>
      </div>
    )
  }

  // Show empty cart message
  if (!checkoutData || checkoutData.items.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Tu carrito está vacío
        </h1>
        <p className="text-gray-600 mb-8">
          Agrega paquetes a tu carrito antes de proceder al checkout.
        </p>
        <Link href="/paquetes">
          <Button>Ver Paquetes</Button>
        </Link>
      </div>
    )
  }

  // Success state
  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          ¡Compra Exitosa!
        </h1>

        {(checkoutData?.testMode || isFreeOrder) && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
            <TestTube2 className="h-4 w-4" />
            {isFreeOrder ? 'Paquete gratuito' : 'Modo prueba'}
          </div>
        )}

        <p className="text-gray-600 mb-6">
          Tu paquete de clases ha sido activado.
          {purchases.length > 0 && (
            <span className="block mt-2">
              Tienes <strong className="text-primary">{purchases[0].classesRemaining}</strong> clases disponibles.
            </span>
          )}
        </p>

        {purchases.length > 0 && (
          <div className="bg-beige p-4 rounded-lg mb-6 text-left">
            <h3 className="font-medium mb-2">Paquetes activados:</h3>
            {purchases.map((purchase) => (
              <div key={purchase.id} className="flex justify-between text-sm py-1">
                <span>{purchase.packageName}</span>
                <span className="text-primary">{purchase.classesRemaining} clases</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">
          Serás redirigido a tus paquetes en unos segundos...
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/reservar">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px]">
              Reservar mi primera clase
            </Button>
          </Link>
          <Link href="/perfil/paquetes">
            <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
              Ver mis paquetes
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/carrito"
          className="p-2 rounded-full hover:bg-beige transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Checkout
          </h1>
          <p className="text-gray-600 mt-1">
            Completa tu compra de forma segura
          </p>
        </div>
      </div>

      {/* Free order banner */}
      {isFreeOrder && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <TestTube2 className="h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              ¡Orden gratuita!
            </p>
            <p className="text-sm text-amber-700">
              Tu codigo de descuento cubre el 100% del total. No se requiere pago.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Información de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {isFreeOrder ? (
                  // Free order - no payment needed
                  <div className="text-center py-6">
                    <TestTube2 className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                    <p className="text-gray-600 mb-2">
                      ¡Tu descuento cubre el 100% del total!
                    </p>
                    <p className="text-sm text-gray-500">
                      Haz clic en "Confirmar" para activar tu paquete gratis.
                    </p>
                  </div>
                ) : (
                  // PayWay payment - show info and redirect
                  <div className="text-center py-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Lock className="h-8 w-8 text-primary" />
                      <span className="font-serif text-xl font-semibold text-foreground">
                        PayWay One
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">
                      Pago seguro con Banco Cuscatlan
                    </p>
                    <p className="text-sm text-gray-500">
                      Haz clic en "Continuar al pago" para procesar tu tarjeta de forma segura.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 p-4 bg-beige rounded-lg">
                  <Lock className="h-5 w-5 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    Tu información de pago está encriptada y protegida
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isProcessing}
                >
                  {isProcessing
                    ? 'Procesando...'
                    : isFreeOrder
                    ? 'Confirmar Paquete Gratis'
                    : `Continuar al pago ${formatPrice(total)}`}
                </Button>
              </CardContent>
            </Card>
          </form>

          {/* Payment methods */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="text-sm text-gray-500">
              {isFreeOrder ? 'Orden gratuita' : 'Procesado por'}
            </span>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="font-bold">
                {isFreeOrder ? 'Descuento 100%' : 'PayWay One - Banco Cuscatlan'}
              </span>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Items */}
              <div className="space-y-4">
                {checkoutData.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.classCount} clases × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-4 border-t border-beige">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-primary">
                    <span className="flex items-center gap-1">
                      Descuento
                      <Badge variant="success" className="text-xs">
                        {appliedDiscount.code}
                      </Badge>
                    </span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-beige">
                  <span>Total</span>
                  <span className="font-serif">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Package details */}
              <div className="p-4 bg-beige rounded-lg text-sm">
                <p className="font-medium text-foreground mb-2">
                  Tu compra incluye:
                </p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Acceso a todas las disciplinas
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Reserva desde la app
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Cancelación flexible
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
