'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Check,
  Loader2,
  AlertCircle,
  CreditCard,
  Calendar,
  Package,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface OrderItem {
  id: string
  packageId: string
  packageName: string
  classCount: number
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Transaction {
  id: string
  provider: string
  status: string
  authorizationNumber?: string
  cardBrand?: string
  cardLastDigits?: string
  createdAt: string
}

interface Order {
  id: string
  status: string
  subtotal: number
  discount: number
  total: number
  discountCode?: string
  createdAt: string
  paidAt?: string
  items: OrderItem[]
  transactions: Transaction[]
}

export default function CheckoutSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()

  const orderId = params.orderId as string

  const [isLoading, setIsLoading] = React.useState(true)
  const [order, setOrder] = React.useState<Order | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch order data on mount
  React.useEffect(() => {
    if (authStatus === 'loading') return

    if (authStatus === 'unauthenticated') {
      router.push(`/login?redirect=/checkout/success/${orderId}`)
      return
    }

    fetchOrderData()
  }, [authStatus, orderId])

  // Auto-redirect to packages after 10 seconds
  React.useEffect(() => {
    if (order?.status === 'PAID') {
      const timer = setTimeout(() => {
        router.push('/perfil/paquetes')
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [order, router])

  const fetchOrderData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/orders?id=${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error al cargar la orden')
        return
      }

      if (data.order.status !== 'PAID') {
        // Order not paid yet, redirect to payment page
        router.push(`/checkout/payway/${orderId}`)
        return
      }

      setOrder(data.order)
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error de conexion. Por favor intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  // Get the successful transaction
  const successTransaction = order?.transactions.find((tx) => tx.status === 'APPROVED')

  // Auth loading
  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Error
        </h1>
        <p className="text-gray-600 mb-8">{error}</p>
        <Link href="/perfil/paquetes">
          <Button>Ver mis paquetes</Button>
        </Link>
      </div>
    )
  }

  // Success state
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      {/* Success header */}
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          Pago Exitoso
        </h1>
        <p className="text-gray-600">
          Tu compra ha sido procesada correctamente
        </p>
      </div>

      {/* Order details card */}
      {order && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Detalles del Pedido</span>
              <Badge variant="success">Pagado</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Packages purchased */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Paquetes adquiridos
              </h3>
              <div className="bg-beige rounded-lg p-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground">{item.packageName}</p>
                      <p className="text-sm text-gray-600">
                        {item.classCount * item.quantity} clases disponibles
                      </p>
                    </div>
                    <p className="font-medium">{formatPrice(item.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction details */}
            {successTransaction && (
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Informacion de la transaccion
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {successTransaction.authorizationNumber && (
                    <div>
                      <p className="text-gray-600">Autorizacion</p>
                      <p className="font-medium">{successTransaction.authorizationNumber}</p>
                    </div>
                  )}
                  {successTransaction.cardBrand && (
                    <div>
                      <p className="text-gray-600">Tarjeta</p>
                      <p className="font-medium">
                        {successTransaction.cardBrand} ****{successTransaction.cardLastDigits}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600">Proveedor</p>
                    <p className="font-medium">{successTransaction.provider}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Fecha</p>
                    <p className="font-medium">
                      {format(new Date(successTransaction.createdAt), "d 'de' MMMM, yyyy", {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Order summary */}
            <div className="space-y-3 pt-4 border-t border-beige">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span className="flex items-center gap-1">
                    Descuento
                    {order.discountCode && (
                      <Badge variant="success" className="text-xs">
                        {order.discountCode}
                      </Badge>
                    )}
                  </span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-beige">
                <span>Total pagado</span>
                <span className="font-serif">{formatPrice(order.total)}</span>
              </div>
            </div>

            {/* Order reference */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-beige">
              <span>Orden: {order.id}</span>
              {order.paidAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(order.paidAt), "d/MM/yyyy HH:mm", { locale: es })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/reservar">
          <Button size="lg" className="w-full sm:w-auto min-w-[200px]">
            Reservar mi primera clase
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
        <Link href="/perfil/paquetes">
          <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
            Ver mis paquetes
          </Button>
        </Link>
      </div>

      {/* Auto redirect notice */}
      <p className="text-center text-sm text-gray-500">
        Seras redirigido a tus paquetes en unos segundos...
      </p>
    </div>
  )
}
