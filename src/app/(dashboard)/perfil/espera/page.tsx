'use client'

import * as React from 'react'
import { Clock, Calendar, User, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate, formatTime } from '@/lib/utils'

interface WaitlistItem {
  id: string
  classId: string
  className: string
  instructor: string
  dateTime: string
  position: number
  totalInWaitlist: number
  createdAt: string
}

export default function ListaEsperaPage() {
  const [items, setItems] = React.useState<WaitlistItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchWaitlist = async () => {
    try {
      const response = await fetch('/api/waitlist')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchWaitlist()
  }, [])

  const handleRemoveFromWaitlist = async (id: string) => {
    setRemovingId(id)
    setMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistId: id }),
      })

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id))
        setMessage({ type: 'success', text: 'Has salido de la lista de espera' })
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Error al salir de la lista' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setRemovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Lista de Espera
        </h1>
        <p className="text-gray-600 mt-1">
          Clases en las que estás esperando un cupo
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Waitlist Items */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="font-medium text-foreground mb-2">
              No estás en ninguna lista de espera
            </h3>
            <p className="text-gray-600 mb-6">
              Cuando una clase esté llena, podrás unirte a la lista de espera
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Class info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-serif text-xl font-semibold text-foreground">
                        {item.className}
                      </h3>
                      <Badge variant="warning">
                        Posición #{item.position} de {item.totalInWaitlist}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(new Date(item.dateTime))}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(new Date(item.dateTime))}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {item.instructor}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWaitlist(item.id)}
                    disabled={removingId === item.id}
                    className="text-gray-500 hover:text-[var(--color-error)]"
                  >
                    {removingId === item.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Salir de la lista
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info note - Updated for auto-assignment, no notifications */}
      <div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600 space-y-2">
        <p>
          <strong>Importante:</strong> Actualmente no enviamos notificaciones por correo
          electrónico. Te recomendamos revisar esta página regularmente para verificar si
          se liberó un cupo.
        </p>
        <p>
          <strong>Asignación automática:</strong> Cuando alguien cancela su reserva, el
          primer lugar de la lista de espera será asignado automáticamente si tiene clases
          disponibles en su paquete. El cupo se descontará de tu paquete activo más próximo
          a vencer.
        </p>
      </div>
    </div>
  )
}
