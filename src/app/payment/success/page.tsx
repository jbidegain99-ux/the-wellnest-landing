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
 *
 * Next.js 14.2+ requires any component using `useSearchParams()` to be
 * wrapped in a <Suspense> boundary so the rest of the route can prerender
 * while the searchParams resolve on the client. We split the logic into
 * an inner component and wrap it here.
 */
export default function PaymentSuccessPage() {
  return (
    <React.Suspense fallback={<PaymentSuccessShell />}>
      <PaymentSuccessContent />
    </React.Suspense>
  )
}

type VerifyState = 'verifying' | 'confirmed' | 'unverified'

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('oid')
  const [state, setState] = React.useState<VerifyState>('verifying')

  // Verificar el estado REAL de la orden: la URL es forjable y antes esta
  // página afirmaba "Pago Exitoso" sin consultar nada.
  React.useEffect(() => {
    let cancelled = false
    const verify = async () => {
      if (!orderId) {
        if (!cancelled) setState('unverified')
        return
      }
      try {
        const response = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`)
        const data = await response.json().catch(() => null)
        if (cancelled) return
        if (response.ok && data?.order?.status === 'PAID') {
          setState('confirmed')
        } else {
          // Sin sesión (401) o aún PENDING: no afirmar éxito
          setState('unverified')
        }
      } catch {
        if (!cancelled) setState('unverified')
      }
    }
    verify()
    return () => { cancelled = true }
  }, [orderId])

  React.useEffect(() => {
    if (state === 'verifying') return
    const timer = setTimeout(() => {
      router.push('/perfil/paquetes?payment=success')
    }, 1800)
    return () => clearTimeout(timer)
  }, [router, state])

  return <PaymentSuccessShell orderId={orderId} state={state} />
}

function PaymentSuccessShell({
  orderId,
  state = 'verifying',
}: {
  orderId?: string | null
  state?: VerifyState
}) {
  const title =
    state === 'confirmed'
      ? 'Pago Exitoso'
      : state === 'verifying'
        ? 'Verificando tu pago…'
        : 'Estamos confirmando tu pago'
  const subtitle =
    state === 'confirmed'
      ? 'Tu pago ha sido procesado correctamente.'
      : state === 'verifying'
        ? 'Un momento por favor.'
        : 'Tu compra aparecerá en tus paquetes en cuanto se confirme el pago.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-beige p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          {state === 'verifying' ? (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-primary" />
          )}
        </div>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
          {title}
        </h1>

        <p className="text-gray-600 mb-6">{subtitle}</p>

        {state !== 'verifying' && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirigiendo a tus paquetes...</span>
          </div>
        )}

        {orderId && /^[A-Za-z0-9_-]+$/.test(orderId) && (
          <p className="text-xs text-gray-400 mt-4">
            Orden: {orderId}
          </p>
        )}
      </div>
    </div>
  )
}
