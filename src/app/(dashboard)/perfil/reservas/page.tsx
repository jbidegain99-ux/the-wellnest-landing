'use client'

import * as React from 'react'
import Link from 'next/link'
import { Calendar, Clock, User, UserPlus, MapPin, X, Plus, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
  guestStatus: string | null
  purchase: {
    classesRemaining: number
    package: {
      name: string
      isShareable: boolean
      maxShares: number
    }
  }
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

  // Add-guest modal state
  const [guestModalFor, setGuestModalFor] = React.useState<Reservation | null>(null)
  const [guestEmail, setGuestEmail] = React.useState('')
  const [guestName, setGuestName] = React.useState('')
  const [isAddingGuest, setIsAddingGuest] = React.useState(false)
  const [addGuestError, setAddGuestError] = React.useState<string | null>(null)
  const [addGuestSuccess, setAddGuestSuccess] = React.useState(false)

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

  // Check if reservation can be cancelled (8 hours before class)
  const canCancel = (reservation: Reservation): boolean => {
    const classDate = new Date(reservation.class.dateTime)
    const now = new Date()
    const hoursUntilClass = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilClass >= 8
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

  const openGuestModal = (reservation: Reservation) => {
    setGuestModalFor(reservation)
    setGuestEmail('')
    setGuestName('')
    setAddGuestError(null)
    setAddGuestSuccess(false)
  }

  const closeGuestModal = () => {
    setGuestModalFor(null)
  }

  const handleAddGuest = async () => {
    if (!guestModalFor) return
    setIsAddingGuest(true)
    setAddGuestError(null)
    try {
      const response = await fetch('/api/reservations/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: guestModalFor.id,
          guest: { email: guestEmail.trim(), name: guestName.trim() || undefined },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setAddGuestSuccess(true)
        await fetchReservations()
      } else {
        setAddGuestError(data.error || 'No pudimos agregar a tu invitado.')
      }
    } catch {
      setAddGuestError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setIsAddingGuest(false)
    }
  }

  const guestByClassId = React.useMemo(
    () =>
      new Map(
        reservations
          .filter((r) => r.isGuestReservation)
          .map((r) => [r.class.id, r] as const)
      ),
    [reservations]
  )

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
            .filter((r) => !r.isGuestReservation) // Only show buyer's own reservations
            .map((reservation) => {
            const guestSibling = guestByClassId.get(reservation.class.id)
            const classDate = new Date(reservation.class.dateTime)
            const canCancelReservation = canCancel(reservation)
            const canAddGuest =
              !guestSibling &&
              reservation.purchase?.package?.isShareable === true &&
              reservation.purchase.package.maxShares >= 1 &&
              classDate.getTime() > Date.now()

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
                        {guestSibling && (
                          <div className="flex items-center gap-2 text-sm text-[#2D5A4A] bg-[#2D5A4A]/5 rounded-lg px-3 py-2">
                            <UserPlus className="h-4 w-4" />
                            <span>
                              Con invitado: {guestSibling.guestName || guestSibling.guestEmail}
                              {guestSibling.guestName && guestSibling.guestEmail && (
                                <span className="text-gray-500 ml-1">({guestSibling.guestEmail})</span>
                              )}
                              {guestSibling.guestStatus && (
                                <span className={`ml-2 text-xs font-medium ${
                                  guestSibling.guestStatus === 'ACCEPTED' ? 'text-green-600' :
                                  guestSibling.guestStatus === 'DECLINED' ? 'text-red-500' :
                                  'text-yellow-600'
                                }`}>
                                  {guestSibling.guestStatus === 'ACCEPTED' ? '• Aceptada' :
                                   guestSibling.guestStatus === 'DECLINED' ? '• Declinada' :
                                   '• Pendiente'}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {canAddGuest && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openGuestModal(reservation)}
                            className="text-[#2D5A4A] hover:bg-[#2D5A4A]/10"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Agregar invitado
                          </Button>
                        )}
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
                            No cancelable (menos de 8h)
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
        hasta 8 horas antes del inicio de la clase sin penalización. Las
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
                  Tu reserva ha sido cancelada y las clases se devolvieron a tu paquete.
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
                    {guestByClassId.has(selectedReservation.class.id)
                      ? 'Se cancelará tu reserva y la de tu invitado. Se devolverán 2 clases a tu paquete. Esta acción no se puede deshacer.'
                      : 'Al cancelar esta reserva, se devolverá 1 clase a tu paquete. Esta acción no se puede deshacer.'
                    }
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

      {/* Add Guest Modal */}
      <Modal open={guestModalFor !== null} onOpenChange={(open) => !open && closeGuestModal()}>
        <ModalContent>
          {addGuestSuccess ? (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  Invitado agregado
                </h3>
                <p className="text-gray-600">
                  Tu invitado ya tiene su cupo en esta clase.
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closeGuestModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>Agregar invitado</ModalTitle>
              </ModalHeader>

              {guestModalFor && (
                <form
                  id="add-guest-form"
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAddGuest()
                  }}
                >
                  <div
                    className={`p-4 rounded-xl text-white ${classColors[guestModalFor.class.discipline.slug] || 'bg-primary'}`}
                  >
                    <p className="font-serif text-xl font-semibold">
                      {guestModalFor.class.discipline.name}
                    </p>
                    <p className="text-sm opacity-90">
                      {formatDate(new Date(guestModalFor.class.dateTime))} a las {formatTime(new Date(guestModalFor.class.dateTime))}
                    </p>
                  </div>

                  <Input
                    label="Correo del invitado"
                    type="email"
                    required
                    autoComplete="off"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                  <Input
                    label="Nombre del invitado (opcional)"
                    autoComplete="off"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />

                  <p className="text-sm text-gray-600">
                    Tu invitado usa 1 clase de tu paquete &quot;{guestModalFor.purchase.package.name}&quot;
                    {' '}(te quedan {guestModalFor.purchase.classesRemaining}).
                  </p>

                  {addGuestError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {addGuestError}
                    </div>
                  )}
                </form>
              )}

              <ModalFooter>
                <Button variant="ghost" onClick={closeGuestModal} disabled={isAddingGuest}>
                  Volver
                </Button>
                <Button
                  type="submit"
                  form="add-guest-form"
                  isLoading={isAddingGuest}
                  disabled={!guestEmail.trim() || (guestModalFor?.purchase.classesRemaining ?? 0) < 1}
                >
                  Agregar invitado
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
