'use client'

import * as React from 'react'
import Link from 'next/link'
import { Calendar, Clock, User, UserPlus, MapPin, X, Plus, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { formatDate, formatTime } from '@/lib/utils'

interface Reservation {
  id: string
  status: string
  createdAt: string
  purchaseId: string
  isGuestReservation: boolean
  guestEmail: string | null
  guestName: string | null
  class: {
    id: string
    dateTime: string
    duration: number
    maxCapacity: number
    discipline: {
      id: string
      name: string
      slug: string
    }
    instructor: {
      id: string
      name: string
    }
  }
}

const classColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#E5E5E5]',
  soundbath: 'bg-[#F5E9DD]',
  'terapia-de-sonido': 'bg-[#F5E9DD]',
  nutricion: 'bg-[#6B7F5E]',
}

export default function ReservasPage() {
  const [reservations, setReservations] = React.useState<Reservation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false)
  const [selectedReservation, setSelectedReservation] = React.useState<Reservation | null>(null)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [cancelSuccess, setCancelSuccess] = React.useState(false)
  const [cancelError, setCancelError] = React.useState<string | null>(null)

  // Fetch reservations from API
  const fetchReservations = React.useCallback(async () => {
    console.log('[RESERVAS] Fetching reservations...')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reservations')

      if (!response.ok) {
        throw new Error('Error al cargar las reservas')
      }

      const data = await response.json()
      console.log('[RESERVAS] Reservations loaded:', data.length)
      setReservations(data)
    } catch (err) {
      console.error('[RESERVAS] Error:', err)
      setError('No se pudieron cargar tus reservas. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  // Check if reservation can be cancelled (4 hours before class)
  const canCancel = (reservation: Reservation): boolean => {
    const classDate = new Date(reservation.class.dateTime)
    const now = new Date()
    const hoursUntilClass = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilClass >= 4
  }

  const handleOpenCancelModal = (reservation: Reservation) => {
    console.log('[RESERVAS] Opening cancel modal for:', reservation.id)
    setSelectedReservation(reservation)
    setCancelError(null)
    setCancelSuccess(false)
    setCancelModalOpen(true)
  }

  const handleCancelReservation = async () => {
    if (!selectedReservation) return

    console.log('[RESERVAS] Cancelling reservation:', selectedReservation.id)
    setIsCancelling(true)
    setCancelError(null)

    try {
      const response = await fetch('/api/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: selectedReservation.id }),
      })

      const data = await response.json()

      if (response.ok) {
        console.log('[RESERVAS] Cancellation successful:', data)
        setCancelSuccess(true)
        // Refresh the reservations list
        await fetchReservations()
      } else {
        console.error('[RESERVAS] Cancellation failed:', data.error)
        setCancelError(data.error || 'Error al cancelar la reserva')
      }
    } catch (err) {
      console.error('[RESERVAS] Network error:', err)
      setCancelError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setIsCancelling(false)
    }
  }

  const closeCancelModal = () => {
    setCancelModalOpen(false)
    setTimeout(() => {
      setSelectedReservation(null)
      setCancelError(null)
      setCancelSuccess(false)
    }, 150)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-6" />
        <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
          Error al cargar reservas
        </h1>
        <p className="text-gray-600 mb-8">{error}</p>
        <Button onClick={fetchReservations}>Reintentar</Button>
      </div>
    )
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
      {reservations.length === 0 ? (
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
          {reservations
            .filter((r) => !r.isGuestReservation) // Only show buyer's reservations as cards
            .map((reservation) => {
            const classDate = new Date(reservation.class.dateTime)
            const canCancelReservation = canCancel(reservation)

            // Find linked guest reservation for the same class
            const guestReservation = reservations.find(
              (r) =>
                r.isGuestReservation &&
                r.class.id === reservation.class.id &&
                r.status === 'CONFIRMED'
            )

            return (
              <Card key={reservation.id} className="overflow-hidden">
                <div className="flex">
                  {/* Color bar */}
                  <div
                    className={`w-2 ${classColors[reservation.class.discipline.slug] || 'bg-primary'}`}
                  />

                  <CardContent className="flex-1 p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Class info */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-serif text-xl font-semibold text-foreground">
                            {reservation.class.discipline.name}
                          </h3>
                          <Badge variant="success">Confirmada</Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(classDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatTime(classDate)} ({reservation.class.duration} min)
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {reservation.class.instructor.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Wellnest Studio
                          </span>
                        </div>

                        {/* Guest info */}
                        {guestReservation && (
                          <div className="flex items-center gap-2 text-sm text-[#2D5A4A] bg-[#2D5A4A]/5 rounded-lg px-3 py-2">
                            <UserPlus className="h-4 w-4" />
                            <span>
                              Con invitado: {guestReservation.guestName || guestReservation.guestEmail}
                              {guestReservation.guestName && guestReservation.guestEmail && (
                                <span className="text-gray-500 ml-1">({guestReservation.guestEmail})</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {canCancelReservation ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCancelModal(reservation)}
                            className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500 flex items-center">
                            No cancelable (menos de 4h)
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info note */}
      <div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600">
        <strong>Política de cancelación:</strong> Puedes cancelar tu reserva
        hasta 4 horas antes del inicio de la clase sin penalización. Las
        cancelaciones tardías o no asistencias resultarán en la pérdida de la
        clase de tu paquete.
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal open={cancelModalOpen} onOpenChange={(open) => !open && closeCancelModal()}>
        <ModalContent>
          {cancelSuccess ? (
            // Success state
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  Reserva Cancelada
                </h3>
                <p className="text-gray-600">
                  Tu reserva ha sido cancelada y la clase ha sido devuelta a tu paquete.
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closeCancelModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          ) : (
            // Confirmation state
            <>
              <ModalHeader>
                <ModalTitle>¿Cancelar Reserva?</ModalTitle>
              </ModalHeader>

              {selectedReservation && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl text-white ${classColors[selectedReservation.class.discipline.slug] || 'bg-primary'}`}
                  >
                    <p className="font-serif text-xl font-semibold">
                      {selectedReservation.class.discipline.name}
                    </p>
                    <p className="text-sm opacity-90">
                      {formatDate(new Date(selectedReservation.class.dateTime))} a las {formatTime(new Date(selectedReservation.class.dateTime))}
                    </p>
                  </div>

                  <p className="text-gray-600">
                    {(() => {
                      const hasGuest = selectedReservation && reservations.find(
                        (r) =>
                          r.isGuestReservation &&
                          r.class.id === selectedReservation.class.id &&
                          r.status === 'CONFIRMED'
                      )
                      return hasGuest
                        ? 'Se cancelará tu reserva y la de tu invitado. Se devolverán 2 clases a tu paquete. Esta acción no se puede deshacer.'
                        : 'Al cancelar esta reserva, se devolverá 1 clase a tu paquete. Esta acción no se puede deshacer.'
                    })()}
                  </p>

                  {cancelError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {cancelError}
                    </div>
                  )}
                </div>
              )}

              <ModalFooter>
                <Button variant="ghost" onClick={closeCancelModal} disabled={isCancelling}>
                  Volver
                </Button>
                <Button
                  onClick={handleCancelReservation}
                  isLoading={isCancelling}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sí, Cancelar Reserva
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
