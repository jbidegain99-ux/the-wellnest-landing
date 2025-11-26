'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Minus, ShoppingBag, Tag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

// Mock cart data
const initialCartItems = [
  {
    id: '1',
    packageId: '3',
    packageName: '8 Clases',
    classCount: 8,
    price: 90,
    quantity: 1,
  },
]

export default function CarritoPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = React.useState(initialCartItems)
  const [discountCode, setDiscountCode] = React.useState('')
  const [appliedDiscount, setAppliedDiscount] = React.useState<{
    code: string
    percentage: number
  } | null>(null)
  const [discountError, setDiscountError] = React.useState('')
  const [isApplyingDiscount, setIsApplyingDiscount] = React.useState(false)

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const discount = appliedDiscount ? (subtotal * appliedDiscount.percentage) / 100 : 0
  const total = subtotal - discount

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    setCartItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    )
  }

  const removeItem = (id: string) => {
    setCartItems((items) => items.filter((item) => item.id !== id))
  }

  const applyDiscountCode = async () => {
    setDiscountError('')
    setIsApplyingDiscount(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (discountCode.toUpperCase() === 'WELCOME10') {
      setAppliedDiscount({ code: discountCode.toUpperCase(), percentage: 10 })
      setDiscountCode('')
    } else {
      setDiscountError('Código de descuento inválido')
    }

    setIsApplyingDiscount(false)
  }

  const removeDiscount = () => {
    setAppliedDiscount(null)
  }

  const handleCheckout = () => {
    router.push('/checkout')
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-gray-400 mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Tu carrito está vacío
        </h1>
        <p className="text-gray-600 mb-8">
          Explora nuestros paquetes y comienza tu viaje de bienestar.
        </p>
        <Link href="/paquetes">
          <Button>Ver Paquetes</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Carrito de Compras
        </h1>
        <p className="text-gray-600 mt-1">
          {cartItems.length} {cartItems.length === 1 ? 'paquete' : 'paquetes'} en
          tu carrito
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-foreground">
                      {item.packageName}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {item.classCount} clases incluidas
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 rounded-full hover:bg-beige transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded-full hover:bg-beige transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Price */}
                    <p className="font-serif text-xl font-semibold text-foreground min-w-[80px] text-right">
                      {formatPrice(item.price * item.quantity)}
                    </p>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-gray-400 hover:text-[var(--color-error)] transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add more */}
          <Link href="/paquetes">
            <Button variant="ghost" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Agregar más paquetes
            </Button>
          </Link>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Discount code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de descuento
                </label>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">
                        {appliedDiscount.code}
                      </span>
                      <Badge variant="success">
                        -{appliedDiscount.percentage}%
                      </Badge>
                    </div>
                    <button
                      onClick={removeDiscount}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      placeholder="Ingresa tu código"
                      error={discountError}
                    />
                    <Button
                      variant="outline"
                      onClick={applyDiscountCode}
                      disabled={!discountCode}
                      isLoading={isApplyingDiscount}
                    >
                      Aplicar
                    </Button>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-4 border-t border-beige">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-primary">
                    <span>Descuento ({appliedDiscount.percentage}%)</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-beige">
                  <span>Total</span>
                  <span className="font-serif">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <Button onClick={handleCheckout} className="w-full" size="lg">
                Proceder al pago
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Pago seguro procesado por Stripe
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
