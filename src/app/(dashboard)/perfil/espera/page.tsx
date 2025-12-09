'use client'

import { Clock, Calendar, User, Bell, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate, formatTime } from '@/lib/utils'

// Mock data
const waitlistItems = [
  {
    id: '1',
    className: 'Yoga',
    instructor: 'María García',
    dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    position: 2,
    totalInWaitlist: 3,
  },
  {
    id: '2',
    className: 'Pole Fitness',
    instructor: 'Carolina López',
    dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
    position: 1,
    totalInWaitlist: 2,
  },
]

export default function ListaEsperaPage() {
  const handleRemoveFromWaitlist = (id: string) => {
    console.log('Removing from waitlist:', id)
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

      {/* Waitlist Items */}
      {waitlistItems.length === 0 ? (
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
          {waitlistItems.map((item) => (
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
                        {formatDate(item.dateTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(item.dateTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {item.instructor}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Bell className="h-4 w-4" />
                      <span>
                        Te notificaremos cuando se libere un cupo
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWaitlist(item.id)}
                    className="text-gray-500 hover:text-[var(--color-error)]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Salir de la lista
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600">
        <strong>¿Cómo funciona?</strong> Cuando alguien cancela su reserva, el
        primer lugar de la lista de espera recibirá una notificación y tendrá
        30 minutos para confirmar su asistencia antes de que el cupo pase a la
        siguiente persona.
      </div>
    </div>
  )
}
