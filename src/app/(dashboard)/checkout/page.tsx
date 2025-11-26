'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Lock, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

// Mock order data
const orderSummary = {
  items: [
    {
      name: '8 Clases',
      classCount: 8,
      price: 90,
      quantity: 1,
    },
  ],
  subtotal: 90,
  discount: 9,
  discountCode: 'WELCOME10',
  total: 81,
}

export default function CheckoutPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isComplete, setIsComplete] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsProcessing(false)
    setIsComplete(true)
  }

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          ¡Compra Exitosa!
        </h1>
        <p className="text-gray-600 mb-8">
          Tu paquete de clases ha sido activado. Recibirás un email de
          confirmación con los detalles de tu compra.
        </p>
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
                  {isProcessing ? 'Procesando...' : `Pagar ${formatPrice(orderSummary.total)}`}
                </Button>
              </CardContent>
            </Card>
          </form>

          {/* Payment methods */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="text-sm text-gray-500">Procesado por</span>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="font-bold">Stripe</span>
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
                {orderSummary.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
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
                  <span>{formatPrice(orderSummary.subtotal)}</span>
                </div>
                {orderSummary.discountCode && (
                  <div className="flex justify-between text-sm text-primary">
                    <span className="flex items-center gap-1">
                      Descuento
                      <Badge variant="success" className="text-xs">
                        {orderSummary.discountCode}
                      </Badge>
                    </span>
                    <span>-{formatPrice(orderSummary.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-beige">
                  <span>Total</span>
                  <span className="font-serif">
                    {formatPrice(orderSummary.total)}
                  </span>
                </div>
              </div>

              {/* Package details */}
              <div className="p-4 bg-beige rounded-lg text-sm">
                <p className="font-medium text-foreground mb-2">
                  Tu paquete incluye:
                </p>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    8 clases para cualquier disciplina
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Vigencia de 60 días
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Reserva desde la app
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
