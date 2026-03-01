'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ScanLine, UserCheck, Clock, User, Users,
  Check, X, Loader2, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter,
} from '@/components/ui/Modal'
import { QRScanner } from '@/components/QRScanner'
import { cn, formatClassType } from '@/lib/utils'

interface ReservationData {
  id: string
  status: string
  checkedIn: boolean
  checkedInAt: string | null
  checkedInBy: string | null
  user: {
    id: string
    name: string
    email: string
    profileImage: string | null
  }
  guestName: string | null
  guestEmail: string | null
  guestStatus: string | null
}

interface ClassDetail {
  id: string
  dateTime: string
  duration: number
  classType: string | null
  maxCapacity: number
  discipline: { id: string; name: string; slug: string }
  instructor: { id: string; name: string }
  reservations: ReservationData[]
}

interface ScanResult {
  type: 'success' | 'error'
  message: string
  userName?: string
}

const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#E5E5E5]',
  soundbath: 'bg-[#F5E9DD]',
  'terapia-de-sonido': 'bg-[#F5E9DD]',
  nutricion: 'bg-[#6B7F5E]',
}

export default function ClassAttendancePage() {
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  const [classData, setClassData] = React.useState<ClassDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)

  const fetchClassData = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/attendance/classes/${classId}`)
      if (response.ok) {
        const data = await response.json()
        setClassData(data)
      }
    } catch (error) {
      console.error('Error fetching class data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [classId])

  React.useEffect(() => {
    fetchClassData()
  }, [fetchClassData])

  const handleQRScan = async (qrCode: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    setScanResult(null)

    try {
      const response = await fetch('/api/admin/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode, classId }),
      })

      const data = await response.json()

      if (response.ok) {
        setScanResult({
          type: 'success',
          message: 'Check-in exitoso',
          userName: data.user.name,
        })
        // Refresh data
        await fetchClassData()
        // Auto-clear success after 2.5s
        setTimeout(() => setScanResult(null), 2500)
      } else {
        setScanResult({
          type: 'error',
          message: data.error || 'Error desconocido',
        })
      }
    } catch {
      setScanResult({
        type: 'error',
        message: 'Error de conexión',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualCheckIn = async (reservationId: string) => {
    try {
      const response = await fetch('/api/admin/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      })

      if (response.ok) {
        await fetchClassData()
      }
    } catch (error) {
      console.error('Error manual check-in:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Clase no encontrada</p>
      </div>
    )
  }

  const classDate = new Date(classData.dateTime)
  const checkedInCount = classData.reservations.filter((r) => r.checkedIn).length
  const pendingCount = classData.reservations.filter((r) => !r.checkedIn).length

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/admin/asistencias')}
        className="flex items-center gap-2 text-gray-600 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Asistencias
      </button>

      {/* Class header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              {classData.discipline.name}
            </h1>
            {classData.classType && (
              <span className="text-sm text-gray-500">({formatClassType(classData.classType)})</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {classDate.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {' '}({classData.duration} min)
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {classData.instructor.name}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {classData.reservations.length}/{classData.maxCapacity}
            </span>
          </div>
        </div>

        <Button onClick={() => setScannerOpen(true)} className="gap-2">
          <ScanLine className="h-4 w-4" />
          Escanear QR
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-green-600">{checkedInCount}</p>
              <p className="text-sm text-gray-500">Presentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-yellow-600">{pendingCount}</p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reservations list */}
      <Card>
        <CardContent className="p-0">
          {classData.reservations.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Sin reservaciones para esta clase</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {classData.reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar initials */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium',
                      reservation.checkedIn
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    )}>
                      {reservation.user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{reservation.user.name}</p>
                      <p className="text-xs text-gray-500">{reservation.user.email}</p>
                      {reservation.guestEmail && (
                        <p className="text-xs text-primary mt-0.5">
                          + Invitado: {reservation.guestName || reservation.guestEmail}
                          {reservation.guestStatus && (
                            <span className={cn(
                              'ml-1',
                              reservation.guestStatus === 'ACCEPTED' ? 'text-green-600' :
                              reservation.guestStatus === 'DECLINED' ? 'text-red-500' :
                              'text-yellow-600'
                            )}>
                              ({reservation.guestStatus === 'ACCEPTED' ? 'Aceptada' :
                                reservation.guestStatus === 'DECLINED' ? 'Declinada' : 'Pendiente'})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {reservation.checkedIn ? (
                      <>
                        <div className="text-right">
                          <Badge variant="success">Presente</Badge>
                          {reservation.checkedInAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(reservation.checkedInAt).toLocaleTimeString('es-SV', {
                                hour: '2-digit', minute: '2-digit', hour12: true,
                              })}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleManualCheckIn(reservation.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Deshacer check-in"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleManualCheckIn(reservation.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <Check className="h-4 w-4" />
                        Check-in
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Scanner Modal */}
      <Modal open={scannerOpen} onOpenChange={(open) => !open && setScannerOpen(false)}>
        <ModalContent className="sm:max-w-md">
          <ModalHeader>
            <ModalTitle>Escanear QR de Asistencia</ModalTitle>
          </ModalHeader>

          <div className="space-y-4">
            <QRScanner
              onScan={handleQRScan}
              onError={(err) => setScanResult({ type: 'error', message: err })}
              isActive={scannerOpen}
            />

            {/* Scan result overlay */}
            {scanResult && (
              <div className={cn(
                'p-4 rounded-xl flex items-center gap-3',
                scanResult.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  scanResult.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                )}>
                  {scanResult.type === 'success' ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  {scanResult.userName && (
                    <p className="font-medium text-foreground">{scanResult.userName}</p>
                  )}
                  <p className={cn(
                    'text-sm',
                    scanResult.type === 'success' ? 'text-green-700' : 'text-red-700'
                  )}>
                    {scanResult.message}
                  </p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setScannerOpen(false)}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
