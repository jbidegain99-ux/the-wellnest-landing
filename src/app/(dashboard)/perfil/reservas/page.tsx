'use client'

import Link from 'next/link'
import { Calendar, Clock, User, MapPin, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate, formatTime } from '@/lib/utils'

// Mock data
const upcomingReservations = [
  {
    id: '1',
    className: 'Yoga',
    instructor: 'María García',
    dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    duration: 60,
    location: 'Sala Principal',
    canCancel: true,
  },
  {
    id: '2',
    className: 'Pilates Mat',
    instructor: 'Ana Martínez',
    dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
    duration: 55,
    location: 'Sala 2',
    canCancel: true,
  },
  {
    id: '3',
    className: 'Sound Healing',
    instructor: 'Sofía Hernández',
    dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
    duration: 90,
    location: 'Sala Principal',
    canCancel: true,
  },
]

const classColors: Record<string, string> = {
  Yoga: 'bg-[#9CAF88]',
  'Pilates Mat': 'bg-[#C4A77D]',
  'Pole Sport': 'bg-[#D4A574]',
  'Sound Healing': 'bg-[#8B7355]',
}

export default function ReservasPage() {
  const handleCancelReservation = (id: string) => {
    // Would call API to cancel
    console.log('Canceling reservation:', id)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Próximas Reservas
          </h1>
          <p className="text-gray-600 mt-1">
            Tus clases programadas para los próximos días
          </p>
        </div>
        <Link href="/reservar">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reserva
          </Button>
        </Link>
      </div>

      {/* Reservations List */}
      {upcomingReservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="font-medium text-foreground mb-2">
              No tienes reservas próximas
            </h3>
            <p className="text-gray-600 mb-6">
              Reserva una clase para comenzar tu práctica
            </p>
            <Link href="/reservar">
              <Button>Reservar Clase</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {upcomingReservations.map((reservation) => (
            <Card key={reservation.id} className="overflow-hidden">
              <div className="flex">
                {/* Color bar */}
                <div
                  className={`w-2 ${classColors[reservation.className] || 'bg-primary'}`}
                />

                <CardContent className="flex-1 p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Class info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-xl font-semibold text-foreground">
                          {reservation.className}
                        </h3>
                        <Badge variant="success">Confirmada</Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(reservation.dateTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTime(reservation.dateTime)} ({reservation.duration} min)
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {reservation.instructor}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {reservation.location}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {reservation.canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelReservation(reservation.id)}
                          className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600">
        <strong>Política de cancelación:</strong> Puedes cancelar tu reserva
        hasta 4 horas antes del inicio de la clase sin penalización. Las
        cancelaciones tardías o no asistencias resultarán en la pérdida de la
        clase de tu paquete.
      </div>
    </div>
  )
}
