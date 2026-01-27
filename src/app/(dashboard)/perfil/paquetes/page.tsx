'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Package, Calendar, AlertCircle, ArrowRight, Loader2, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate, getDaysRemaining } from '@/lib/utils'

interface Purchase {
  id: string
  packageId: string
  packageName: string
  classesTotal: number
  classesRemaining: number
  classesUsed: number
  expiresAt: string
  purchasedAt: string
  status: string
}

interface PurchasesData {
  activePurchases: Purchase[]
  historyPurchases: Purchase[]
  totalActive: number
  totalClassesRemaining: number
}

export default function PaquetesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [data, setData] = React.useState<PurchasesData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showSuccessToast, setShowSuccessToast] = React.useState(false)

  // Check for payment success query param
  React.useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowSuccessToast(true)
      // Clean up URL
      router.replace('/perfil/paquetes', { scroll: false })
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccessToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router])

  React.useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const response = await fetch('/api/user/purchases')
        if (!response.ok) {
          throw new Error('Error al cargar los paquetes')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPurchases()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Reintentar
        </Button>
      </div>
    )
  }

  const activePurchases = data?.activePurchases || []
  const historyPurchases = data?.historyPurchases || []

  return (
    <div className="space-y-8">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-white border border-primary/20 shadow-lg rounded-xl p-4 flex items-center gap-3 min-w-[320px]">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Pago exitoso</p>
              <p className="text-sm text-gray-600">Tu paquete ha sido activado</p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="p-1 hover:bg-beige rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Mis Paquetes
          </h1>
          <p className="text-gray-600 mt-1">
            Administra tus paquetes de clases
          </p>
        </div>
        <Link href="/paquetes">
          <Button>
            <Package className="h-4 w-4 mr-2" />
            Comprar Paquete
          </Button>
        </Link>
      </div>

      {/* Active Packages */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
          Paquetes Activos
        </h2>

        {activePurchases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="font-medium text-foreground mb-2">
                No tienes paquetes activos
              </h3>
              <p className="text-gray-600 mb-6">
                Compra un paquete para empezar a reservar clases
              </p>
              <Link href="/paquetes">
                <Button>Ver Paquetes</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activePurchases.map((purchase) => {
              const expiresDate = new Date(purchase.expiresAt)
              const daysRemaining = getDaysRemaining(expiresDate)
              const isLowClasses = purchase.classesRemaining <= 2
              const isExpiringSoon = daysRemaining <= 7

              return (
                <Card key={purchase.id} className="overflow-hidden">
                  <div className="h-2 bg-primary" />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{purchase.packageName}</CardTitle>
                      <Badge variant="success">Activo</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Classes progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Clases restantes</span>
                        <span className="font-medium">
                          {purchase.classesRemaining} de {purchase.classesTotal}
                        </span>
                      </div>
                      <div className="h-2 bg-beige rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${(purchase.classesRemaining / purchase.classesTotal) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">
                        Vence el {formatDate(expiresDate)}
                      </span>
                      {isExpiringSoon && (
                        <Badge variant="warning">{daysRemaining} días</Badge>
                      )}
                    </div>

                    {/* Warnings */}
                    {(isLowClasses || isExpiringSoon) && (
                      <div className="flex items-start gap-2 p-3 bg-[var(--color-warning)]/10 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
                        <span className="text-gray-700">
                          {isLowClasses && isExpiringSoon
                            ? 'Pocas clases y poco tiempo restante'
                            : isLowClasses
                            ? 'Te quedan pocas clases'
                            : 'Tu paquete vence pronto'}
                        </span>
                      </div>
                    )}

                    <Link href={`/reservar?packageId=${purchase.id}`}>
                      <Button variant="outline" className="w-full">
                        Reservar Clase
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Purchase History */}
      {historyPurchases.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
            Historial de Compras
          </h2>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-beige">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Paquete
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Fecha de Compra
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Clases Usadas
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige">
                  {historyPurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {purchase.packageName}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(new Date(purchase.purchasedAt))}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {purchase.classesUsed} de {purchase.classesTotal}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            purchase.classesRemaining === 0 ? 'default' : 'error'
                          }
                        >
                          {purchase.classesRemaining === 0 ? 'Usado' : 'Vencido'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
