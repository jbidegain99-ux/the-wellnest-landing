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
        const savedDiscount = sessionStorage.getItem('cartDiscount')
        if (savedDiscount) {
          setAppliedDiscount(JSON.parse(savedDiscount))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountCode: appliedDiscount?.code,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setPurchases(data.purchases || [])
        setIsComplete(true)
        // Clear discount from sessionStorage
        sessionStorage.removeItem('cartDiscount')
      } else {
        setError(data.error || 'Error al procesar el pago')
      }
    } catch (err) {
      console.error('Error processing checkout:', err)
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

        {checkoutData.testMode && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
            <TestTube2 className="h-4 w-4" />
            Modo prueba
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

        <div className="space-y-4">
          <Link href="/reservar">
            <Button className="w-full">Reservar mi primera clase</Button>
          </Link>
          <Link href="/perfil/paquetes">
            <Button variant="outline" className="w-full">
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

      {/* Test mode banner */}
      {checkoutData.testMode && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <TestTube2 className="h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Modo de prueba activo</p>
            <p className="text-sm text-amber-700">
              Los pagos serán simulados. No se realizarán cargos reales.
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
                {checkoutData.testMode ? (
                  // Test mode - simplified form
                  <div className="text-center py-6">
                    <TestTube2 className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                    <p className="text-gray-600 mb-2">
                      En modo prueba, el pago se simula automáticamente.
                    </p>
                    <p className="text-sm text-gray-500">
                      Haz clic en &quot;Confirmar compra&quot; para activar tu paquete.
                    </p>
                  </div>
                ) : (
                  // Production mode - full payment form (for future Stripe integration)
                  <>
                    <Input
                      label="Nombre en la tarjeta"
                      placeholder="Como aparece en la tarjeta"
                      required
                    />

                    <Input
                      label="Número de tarjeta"
                      placeholder="1234 5678 9012 3456"
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Fecha de expiración"
                        placeholder="MM/AA"
                        required
                      />
                      <Input
                        label="CVV"
                        placeholder="123"
                        type="password"
                        maxLength={4}
                        required
                      />
                    </div>
                  </>
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
                    : checkoutData.testMode
                    ? `Confirmar compra ${formatPrice(total)}`
                    : `Pagar ${formatPrice(total)}`}
                </Button>
              </CardContent>
            </Card>
          </form>

          {/* Payment methods */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="text-sm text-gray-500">
              {checkoutData.testMode ? 'Modo prueba' : 'Procesado por'}
            </span>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="font-bold">
                {checkoutData.testMode ? 'Sin cargos reales' : 'Stripe'}
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
