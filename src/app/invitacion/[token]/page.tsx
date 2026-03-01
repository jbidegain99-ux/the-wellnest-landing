'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Check, X, Calendar, Clock, User, MapPin, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface InvitationData {
  id: string
  guestName: string | null
  guestEmail: string | null
  guestStatus: string | null
  hostName: string
  status: string
  isPast: boolean
  class: {
    disciplineName: string
    instructorName: string
    dateTime: string
    duration: number
  }
}

export default function InvitacionPage() {
  const params = useParams()
  const token = params.token as string

  const [invitation, setInvitation] = React.useState<InvitationData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [responseStatus, setResponseStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations/${token}`)
        if (response.ok) {
          const data = await response.json()
          setInvitation(data)
          if (data.guestStatus === 'ACCEPTED' || data.guestStatus === 'DECLINED') {
            setResponseStatus(data.guestStatus)
          }
        } else {
          const data = await response.json()
          setError(data.error || 'Invitación no encontrada')
        }
      } catch {
        setError('Error de conexión')
      } finally {
        setIsLoading(false)
      }
    }
    fetchInvitation()
  }, [token])

  const handleResponse = async (action: 'accept' | 'decline') => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (response.ok) {
        setResponseStatus(data.guestStatus)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-6" />
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Invitación no disponible
            </h1>
            <p className="text-gray-600">{error || 'No se encontró esta invitación.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const classDate = new Date(invitation.class.dateTime)
  const formattedDate = classDate.toLocaleDateString('es-SV', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const formattedTime = classDate.toLocaleTimeString('es-SV', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  // Already responded
  if (responseStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              responseStatus === 'ACCEPTED' ? 'bg-primary/10' : 'bg-gray-100'
            }`}>
              {responseStatus === 'ACCEPTED' ? (
                <Check className="h-8 w-8 text-primary" />
              ) : (
                <X className="h-8 w-8 text-gray-500" />
              )}
            </div>
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
              {responseStatus === 'ACCEPTED' ? '¡Invitación Aceptada!' : 'Invitación Declinada'}
            </h1>
            <p className="text-gray-600 mb-6">
              {responseStatus === 'ACCEPTED'
                ? `Te esperamos en la clase de ${invitation.class.disciplineName}. Presenta este email al llegar al estudio.`
                : 'Has declinado la invitación.'
              }
            </p>
            {responseStatus === 'ACCEPTED' && (
              <div className="bg-beige rounded-lg p-4 text-sm text-left space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{formattedTime} ({invitation.class.duration} min)</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Wellnest Studio</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Cancelled or past
  if (invitation.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-6" />
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Reserva Cancelada
            </h1>
            <p className="text-gray-600">El anfitrión canceló esta reserva.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.isPast) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-6" />
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Clase Finalizada
            </h1>
            <p className="text-gray-600">Esta clase ya pasó.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Pending — show accept/decline
  return (
    <div className="min-h-screen bg-gradient-to-b from-beige to-cream flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-8 space-y-6">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
              Invitación a Clase
            </h1>
            <p className="text-gray-600">
              <strong className="text-foreground">{invitation.hostName}</strong> te invitó a una clase en Wellnest
            </p>
          </div>

          {/* Class details */}
          <div className="bg-beige rounded-xl p-5 space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              {invitation.class.disciplineName}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="h-4 w-4 text-primary" />
                <span>{formattedTime} ({invitation.class.duration} min)</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <User className="h-4 w-4 text-primary" />
                <span>{invitation.class.instructorName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Wellnest Studio</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            No necesitas cuenta para asistir. Solo confirma y presenta esta página al llegar.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => handleResponse('decline')}
              disabled={isProcessing}
            >
              Declinar
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleResponse('accept')}
              isLoading={isProcessing}
            >
              <Check className="h-4 w-4 mr-2" />
              Aceptar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
