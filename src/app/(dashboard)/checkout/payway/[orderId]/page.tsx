'use client'

import * as React from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Script from 'next/script'
import Link from 'next/link'
import {
  CreditCard,
  Lock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  RefreshCw,
  XCircle,
  ShieldCheck,
  Check,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

// Texto del checkbox de términos (obligatorio)
const TERMS_CHECKBOX_TEXT = 'He leído y acepto los Términos y Condiciones y confirmo que practico bajo mi propia responsabilidad. La participación en las actividades de Wellnest se realiza bajo responsabilidad personal. El usuario declara que su estado de salud le permite realizar actividad física.'

// PayWay global type declaration
declare global {
  interface Window {
    PayWayOneButton?: {
      init: (config: PayWayInitConfig) => void
    }
  }
}

interface PayWayInitConfig {
  id: string
  container: string
  label: string
  token: string
  retailerOwner: string
  userOperation: string
  serviceProduct: string
  userClient: string
  clientIP: string
  amount: string
  responseCallback: string
  deniedCallback?: string
}

interface OrderItem {
  id: string
  packageId: string
  packageName: string
  classCount: number
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Order {
  id: string
  status: string
  subtotal: number
  discount: number
  total: number
  discountCode?: string
  termsAcceptedAt?: string | null
  items: OrderItem[]
}

interface PaywayPayload {
  amountEncrypted: string
  responseCallbackEncrypted: string
  deniedCallbackEncrypted?: string
  serviceProduct: string
  userClient: string
  clientIP: string
  tokenAuth: string
  retailerOwner: string
  userOperation: string
}

type PageStatus = 'loading' | 'ready' | 'initializing' | 'error' | 'denied' | 'processing'

export default function PayWayCheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()

  const orderId = params.orderId as string
  const urlStatus = searchParams.get('status')
  const errorReason = searchParams.get('reason')

  const [pageStatus, setPageStatus] = React.useState<PageStatus>('loading')
  const [order, setOrder] = React.useState<Order | null>(null)
  const [payload, setPayload] = React.useState<PaywayPayload | null>(null)
  const [scriptUrl, setScriptUrl] = React.useState<string>('')
  const [scriptLoaded, setScriptLoaded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  const [termsError, setTermsError] = React.useState(false)
  const [updatingTerms, setUpdatingTerms] = React.useState(false)

  // Fetch order data on mount
  React.useEffect(() => {
    if (authStatus === 'loading') return

    if (authStatus === 'unauthenticated') {
      router.push(`/login?redirect=/checkout/payway/${orderId}`)
      return
    }

    fetchOrderData()
  }, [authStatus, orderId])

  // Handle URL status params (from callback redirects)
  React.useEffect(() => {
    if (urlStatus === 'denied') {
      setPageStatus('denied')
      setError('El pago fue rechazado o cancelado. Puedes intentar nuevamente.')
    } else if (urlStatus === 'error') {
      setPageStatus('error')
      setError(getErrorMessage(errorReason))
    }
  }, [urlStatus, errorReason])

  const fetchOrderData = async () => {
    try {
      setPageStatus('loading')
      setError(null)

      const response = await fetch(`/api/orders?id=${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error al cargar la orden')
        setPageStatus('error')
        return
      }

      if (data.order.status === 'PAID') {
        router.push(`/checkout/success/${orderId}`)
        return
      }

      if (data.order.status !== 'PENDING') {
        setError(`Esta orden no esta disponible para pago (estado: ${data.order.status})`)
        setPageStatus('error')
        return
      }

      setOrder(data.order)
      // Si la orden ya tiene términos aceptados, marcar el checkbox
      if (data.order.termsAcceptedAt) {
        setAcceptedTerms(true)
      }
      setPageStatus('ready')
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error de conexion. Por favor intenta de nuevo.')
      setPageStatus('error')
    }
  }

  // Función para actualizar la aceptación de términos
  const updateTermsAcceptance = async (accept: boolean) => {
    if (!order) return

    setUpdatingTerms(true)
    setTermsError(false)

    try {
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          acceptTerms: accept,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setAcceptedTerms(accept)
        // Actualizar la orden local
        setOrder({
          ...order,
          termsAcceptedAt: data.order.termsAcceptedAt,
        })
      } else {
        setError(data.error || 'Error al actualizar términos')
      }
    } catch (err) {
      console.error('Error updating terms:', err)
      setError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setUpdatingTerms(false)
    }
  }

  const initializePayment = async () => {
    if (!order) return

    // Validar términos aceptados (client-side)
    if (!acceptedTerms) {
      setTermsError(true)
      setError('Debes aceptar los Términos y Condiciones antes de pagar')
      return
    }

    try {
      setPageStatus('initializing')
      setError(null)
      setTermsError(false)

      // 1. Get encrypted payload from server
      const response = await fetch('/api/payments/payway/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Si el error es por términos no aceptados, mostrar error específico
        if (data.termsRequired) {
          setTermsError(true)
          setAcceptedTerms(false)
        }
        setError(data.error || 'Error al inicializar el pago')
        setPageStatus('error')
        return
      }

      setPayload(data.payload)
      setScriptUrl(data.scriptUrl)
      setPageStatus('processing')
    } catch (err) {
      console.error('Error initializing payment:', err)
      setError('Error de conexion. Por favor intenta de nuevo.')
      setPageStatus('error')
    }
  }

  const handleScriptLoad = () => {
    console.log('[PayWay] Script loaded')
    setScriptLoaded(true)
  }

  const handleScriptError = () => {
    console.error('[PayWay] Script failed to load')
    setError('No se pudo cargar el sistema de pago. Por favor intenta de nuevo.')
    setPageStatus('error')
  }

  // Initialize PayWay when script is loaded and payload is ready
  React.useEffect(() => {
    if (pageStatus !== 'processing' || !scriptLoaded || !payload) return

    const container = document.getElementById('paywayBtnContainer')
    if (!container) {
      console.error('[PayWay] Container not found')
      return
    }

    if (!window.PayWayOneButton) {
      console.error('[PayWay] PayWayOneButton not available')
      setError('Sistema de pago no disponible. Por favor recarga la pagina.')
      setPageStatus('error')
      return
    }

    console.log('[PayWay] Initializing payment button')

    try {
      window.PayWayOneButton.init({
        id: 'pwbtn',
        container: 'paywayBtnContainer',
        label: 'Efectuar Pago',
        token: payload.tokenAuth,
        retailerOwner: payload.retailerOwner,
        userOperation: payload.userOperation,
        serviceProduct: payload.serviceProduct,
        userClient: payload.userClient,
        clientIP: payload.clientIP,
        amount: payload.amountEncrypted,
        responseCallback: payload.responseCallbackEncrypted,
        deniedCallback: payload.deniedCallbackEncrypted,
      })

      console.log('[PayWay] Payment button initialized')
    } catch (err) {
      console.error('[PayWay] Error initializing:', err)
      setError('Error al inicializar el pago. Por favor intenta de nuevo.')
      setPageStatus('error')
    }
  }, [pageStatus, scriptLoaded, payload])

  const getErrorMessage = (reason: string | null): string => {
    switch (reason) {
      case 'invalid_status':
        return 'Esta orden no puede ser procesada.'
      case 'processing_failed':
        return 'Error al procesar el pago. Por favor intenta de nuevo.'
      case 'server_error':
        return 'Error del servidor. Por favor intenta mas tarde.'
      default:
        return 'Ocurrio un error. Por favor intenta de nuevo.'
    }
  }

  // Auth loading
  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Page loading
  if (pageStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-gray-600">Cargando orden...</p>
      </div>
    )
  }

  // Error state
  if (pageStatus === 'error' && !order) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Error
        </h1>
        <p className="text-gray-600 mb-8">{error}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={fetchOrderData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          <Link href="/carrito">
            <Button>Volver al carrito</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Denied state
  if (pageStatus === 'denied') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <XCircle className="h-16 w-16 mx-auto text-amber-500 mb-6" />
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
          Pago Rechazado
        </h1>
        <p className="text-gray-600 mb-8">{error}</p>
        <Button onClick={() => {
          setPageStatus('ready')
          setError(null)
          router.replace(`/checkout/payway/${orderId}`)
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Intentar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Load PayWay script when processing */}
      {scriptUrl && pageStatus === 'processing' && (
        <Script
          src={scriptUrl}
          strategy="afterInteractive"
          onLoad={handleScriptLoad}
          onError={handleScriptError}
        />
      )}

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
            Pago Seguro
          </h1>
          <p className="text-gray-600 mt-1">
            Completa tu compra con PayWay
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && pageStatus === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setError(null)
              setPageStatus('ready')
            }}
          >
            Cerrar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Metodo de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PayWay branding */}
              <div className="flex items-center justify-center py-6 bg-beige rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    <span className="font-serif text-2xl font-semibold text-foreground">
                      PayWay One
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Pago seguro con Banco Cuscatlan
                  </p>
                </div>
              </div>

              {/* Payment states */}
              {pageStatus === 'ready' && (
                <div className="space-y-6 py-4">
                  {/* Checkbox de Términos y Condiciones (si no están aceptados) */}
                  {!order?.termsAcceptedAt && (
                    <div className={`p-4 rounded-lg border-2 transition-colors ${
                      termsError
                        ? 'border-red-500 bg-red-50'
                        : acceptedTerms
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-beige bg-beige/50'
                    }`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <div className="relative flex-shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setAcceptedTerms(checked)
                              if (checked) {
                                setTermsError(false)
                                setError(null)
                                // Guardar aceptación en la orden
                                updateTermsAcceptance(true)
                              }
                            }}
                            disabled={updatingTerms}
                            className="sr-only peer"
                            aria-describedby="terms-description-payway"
                            aria-invalid={termsError}
                            aria-required="true"
                          />
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                            acceptedTerms
                              ? 'bg-primary border-primary'
                              : termsError
                              ? 'border-red-500 bg-white'
                              : 'border-gray-400 bg-white'
                          }`}>
                            {acceptedTerms && (
                              <Check className="h-3.5 w-3.5 text-white" />
                            )}
                            {updatingTerms && (
                              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                            )}
                          </div>
                        </div>
                        <span id="terms-description-payway" className="text-sm text-gray-700 leading-relaxed">
                          <FileText className="h-4 w-4 inline-block mr-1 text-primary" />
                          {TERMS_CHECKBOX_TEXT}{' '}
                          <Link
                            href="/terminos"
                            target="_blank"
                            className="text-primary hover:underline font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver Términos completos
                          </Link>
                        </span>
                      </label>
                      {termsError && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Debes aceptar los Términos y Condiciones
                        </p>
                      )}
                    </div>
                  )}

                  {/* Términos ya aceptados */}
                  {order?.termsAcceptedAt && (
                    <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <p className="text-sm text-gray-700">
                        Has aceptado los{' '}
                        <Link href="/terminos" target="_blank" className="text-primary hover:underline">
                          Términos y Condiciones
                        </Link>
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-gray-600 mb-6">
                      Haz clic en el boton para abrir la ventana de pago seguro.
                    </p>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto min-w-[250px]"
                      onClick={initializePayment}
                      disabled={!acceptedTerms && !order?.termsAcceptedAt}
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      Pagar con tarjeta
                    </Button>
                  </div>
                </div>
              )}

              {pageStatus === 'initializing' && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-gray-600">Inicializando pago seguro...</p>
                </div>
              )}

              {pageStatus === 'processing' && (
                <div className="text-center py-4">
                  {!scriptLoaded ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-gray-600">Cargando sistema de pago...</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">
                        Haz clic en el boton de PayWay para completar tu pago.
                      </p>
                      {/* PayWay button container */}
                      <div
                        id="paywayBtnContainer"
                        className="flex justify-center py-4"
                      />
                      <p className="text-sm text-gray-500 mt-4">
                        Se abrira una ventana segura de PayWay
                      </p>
                    </>
                  )}
                </div>
              )}

              {pageStatus === 'error' && order && (
                <div className="text-center py-4">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">{error}</p>
                  <Button onClick={() => {
                    setPageStatus('ready')
                    setError(null)
                  }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Intentar de nuevo
                  </Button>
                </div>
              )}

              {/* Security note */}
              <div className="flex items-center gap-2 p-4 bg-beige rounded-lg">
                <Lock className="h-5 w-5 text-gray-500" />
                <p className="text-sm text-gray-600">
                  Tu informacion de pago esta encriptada y protegida
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Items */}
              {order && (
                <>
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.packageName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {item.classCount} clases x {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">{formatPrice(item.totalPrice)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
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
                      <span>Total</span>
                      <span className="font-serif">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Order ID */}
              <div className="text-xs text-gray-500 pt-2 border-t border-beige">
                Orden: {orderId}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
