'use client'

import Link from 'next/link'
import { Package, Calendar, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPrice, formatDate, getDaysRemaining } from '@/lib/utils'

// Mock data - would come from API
const activePurchases = [
  {
    id: '1',
    packageName: '8 Clases',
    classesRemaining: 5,
    totalClasses: 8,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
  },
  {
    id: '2',
    packageName: '4 Clases',
    classesRemaining: 1,
    totalClasses: 4,
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
  },
]

const purchaseHistory = [
  {
    id: '3',
    packageName: '8 Clases',
    originalPrice: 90,
    finalPrice: 81,
    discountCode: 'WELCOME10',
    purchasedAt: new Date('2023-12-01'),
    status: 'DEPLETED',
  },
  {
    id: '4',
    packageName: '4 Clases',
    originalPrice: 50,
    finalPrice: 50,
    discountCode: null,
    purchasedAt: new Date('2023-11-01'),
    status: 'EXPIRED',
  },
]

export default function PaquetesPage() {
  return (
    <div className="space-y-8">
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
              const daysRemaining = getDaysRemaining(purchase.expiresAt)
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
                          {purchase.classesRemaining} de {purchase.totalClasses}
                        </span>
                      </div>
                      <div className="h-2 bg-beige rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${(purchase.classesRemaining / purchase.totalClasses) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">
                        Vence el {formatDate(purchase.expiresAt)}
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

                    <Link href="/reservar">
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
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Precio
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Descuento
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {purchaseHistory.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {purchase.packageName}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(purchase.purchasedAt)}
                    </td>
                    <td className="py-3 px-4">
                      {purchase.discountCode ? (
                        <div>
                          <span className="line-through text-gray-400 text-sm">
                            {formatPrice(purchase.originalPrice)}
                          </span>
                          <span className="ml-2 font-medium text-foreground">
                            {formatPrice(purchase.finalPrice)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">
                          {formatPrice(purchase.finalPrice)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {purchase.discountCode ? (
                        <Badge variant="secondary">{purchase.discountCode}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          purchase.status === 'DEPLETED' ? 'default' : 'error'
                        }
                      >
                        {purchase.status === 'DEPLETED' ? 'Usado' : 'Vencido'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}
