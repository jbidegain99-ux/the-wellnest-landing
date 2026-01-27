'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

/**
 * Public payment success page.
 *
 * This page is NOT protected by auth middleware, so PayWay can redirect here
 * after a successful payment without losing the user's session.
 *
 * The page then uses client-side navigation to redirect to the protected
 * packages page, which ensures cookies are sent correctly.
 */
export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('oid')

  React.useEffect(() => {
    // Small delay to show the success message, then redirect
    const timer = setTimeout(() => {
      router.push('/perfil/paquetes?payment=success')
    }, 1500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
          Pago Exitoso
        </h1>

        <p className="text-gray-600 mb-6">
          Tu pago ha sido procesado correctamente.
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Redirigiendo a tus paquetes...</span>
        </div>

        {orderId && (
          <p className="text-xs text-gray-400 mt-4">
            Orden: {orderId}
          </p>
        )}
      </div>
    </div>
  )
}
