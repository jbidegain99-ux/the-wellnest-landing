'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Package,
  Calendar,
  ShoppingCart,
  UserCheck,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate, formatPrice } from '@/lib/utils'

interface UserDetail {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
  role: string
  createdAt: string
  activePackages: number
  totalClasses: number
  lastActivity: string
  currentPackage: string | null
}

interface AuditEvent {
  id: string
  type: 'purchase' | 'assignment' | 'attendance' | 'cancellation'
  timestamp: string
  title: string
  description: string
  metadata: Record<string, string | number | null>
}

interface UserPurchase {
  id: string
  packageName: string
  classesRemaining: number
  classCount: number
  expiresAt: string
  status: string
  finalPrice: number
  createdAt: string
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = React.useState<UserDetail | null>(null)
  const [events, setEvents] = React.useState<AuditEvent[]>([])
  const [purchases, setPurchases] = React.useState<UserPurchase[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch(`/api/admin/users/${userId}`)
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        } else {
          setError('Usuario no encontrado')
        }
      } catch {
        setError('Error de conexion')
      } finally {
        setIsLoading(false)
      }
    }

    async function fetchHistory() {
      try {
        const response = await fetch(`/api/admin/users/${userId}/history`)
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events)
        }
      } catch {
        // History is non-critical
      } finally {
        setIsLoadingHistory(false)
      }
    }

    async function fetchPurchases() {
      try {
        const response = await fetch(`/api/admin/users/${userId}/purchases`)
        if (response.ok) {
          const data = await response.json()
          setPurchases(data.purchases)
        }
      } catch {
        // Non-critical
      }
    }

    fetchUser()
    fetchHistory()
    fetchPurchases()
  }, [userId])

  const eventIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart className="h-4 w-4 text-primary" />
      case 'assignment':
        return <Package className="h-4 w-4 text-accent" />
      case 'attendance':
        return <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />
      case 'cancellation':
        return <XCircle className="h-4 w-4 text-[var(--color-error)]" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const eventBadge = (type: string) => {
    switch (type) {
      case 'purchase':
        return <Badge variant="default">Compra</Badge>
      case 'assignment':
        return <Badge variant="secondary">Asignacion</Badge>
      case 'attendance':
        return <Badge variant="success">Asistencia</Badge>
      case 'cancellation':
        return <Badge variant="error">Cancelacion</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push('/admin/usuarios')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a usuarios
        </Button>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{error || 'Usuario no encontrado'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/admin/usuarios')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a usuarios
      </Button>

      {/* User Info Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar
              src={user.image}
              alt={user.name || user.email}
              fallback={user.name || user.email}
              size="xl"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-semibold text-foreground">
                  {user.name || 'Sin nombre'}
                </h1>
                {user.role === 'ADMIN' && (
                  <Badge variant="secondary">Admin</Badge>
                )}
              </div>
              <p className="text-gray-600">{user.email}</p>
              {user.phone && <p className="text-gray-500">{user.phone}</p>}
              <p className="text-sm text-gray-500">
                Miembro desde {formatDate(new Date(user.createdAt))}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="text-center px-4">
                <p className="text-2xl font-serif font-semibold text-primary">
                  {user.activePackages}
                </p>
                <p className="text-xs text-gray-500">Paquetes activos</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-serif font-semibold text-foreground">
                  {user.totalClasses}
                </p>
                <p className="text-xs text-gray-500">Reservas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Purchases */}
      {purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Paquetes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-beige/50 gap-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{p.packageName}</p>
                    <p className="text-sm text-gray-500">
                      {p.classesRemaining} clases restantes de {p.classCount} — Vence: {formatDate(new Date(p.expiresAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatPrice(p.finalPrice)}</span>
                    <Badge
                      variant={
                        p.status === 'ACTIVE' ? 'success' :
                        p.status === 'EXPIRED' ? 'warning' : 'secondary'
                      }
                    >
                      {p.status === 'ACTIVE' ? 'Activo' :
                       p.status === 'EXPIRED' ? 'Expirado' : 'Agotado'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de actividad
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              No hay historial disponible
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-px bg-beige-dark" />

              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="relative flex gap-4 pl-1">
                    {/* Icon dot */}
                    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-beige shadow-sm">
                      {eventIcon(event.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <p className="font-medium text-sm text-foreground">
                          {event.title}
                        </p>
                        {eventBadge(event.type)}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(new Date(event.timestamp))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
