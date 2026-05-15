'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Discipline {
  id: string
  name: string
  slug: string
}
interface Instructor {
  id: string
  name: string
}
interface Purchase {
  id: string
  packageName: string
  classesRemaining: number
  expiresAt: string
  isPrivate: boolean
}
interface PrivateSessionRequest {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
  preferredSlot1: string
  preferredSlot2: string | null
  preferredSlot3: string | null
  notes: string | null
  createdAt: string
  confirmedAt: string | null
  rejectedReason: string | null
  purchase: { id: string; package: { name: string } }
  preferredDiscipline: { name: string; slug: string }
  preferredInstructor: { name: string } | null
  confirmedClasses: {
    id: string
    dateTime: string
    duration: number
    discipline: { name: string }
    instructor: { name: string }
  }[]
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-SV', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/El_Salvador',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function SesionPrivadaPage() {
  const router = useRouter()
  const [privatePurchases, setPrivatePurchases] = React.useState<Purchase[]>([])
  const [requests, setRequests] = React.useState<PrivateSessionRequest[]>([])
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [instructors, setInstructors] = React.useState<Instructor[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Form state
  const [selectedPurchaseId, setSelectedPurchaseId] = React.useState('')
  const [selectedDisciplineId, setSelectedDisciplineId] = React.useState('')
  const [selectedInstructorId, setSelectedInstructorId] = React.useState('')
  const [slot1, setSlot1] = React.useState('')
  const [slot2, setSlot2] = React.useState('')
  const [slot3, setSlot3] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      try {
        const [purchasesRes, requestsRes, disciplinesRes, instructorsRes] = await Promise.all([
          fetch('/api/user/purchases'),
          fetch('/api/private-sessions'),
          fetch('/api/disciplines'),
          fetch('/api/instructors'),
        ])

        if (!purchasesRes.ok) throw new Error('Error al cargar paquetes')
        const purchasesData = await purchasesRes.json()
        const actives: Purchase[] = (purchasesData.activePurchases || []).filter(
          (p: Purchase) => p.isPrivate
        )
        setPrivatePurchases(actives)
        if (actives.length > 0) setSelectedPurchaseId(actives[0].id)

        if (requestsRes.ok) {
          const rd = await requestsRes.json()
          setRequests(rd.requests || [])
        }

        if (disciplinesRes.ok) {
          const dd = await disciplinesRes.json()
          setDisciplines(Array.isArray(dd) ? dd : dd.disciplines || [])
        }

        if (instructorsRes.ok) {
          const id = await instructorsRes.json()
          setInstructors(Array.isArray(id) ? id : id.instructors || [])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const activeRequest = requests.find((r) => r.status === 'PENDING' || r.status === 'CONFIRMED')
  const availablePurchases = privatePurchases.filter(
    (p) =>
      !requests.some(
        (r) =>
          r.purchase.id === p.id && (r.status === 'PENDING' || r.status === 'CONFIRMED')
      )
  )
  const showForm = availablePurchases.length > 0 && !successMessage

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedPurchaseId || !selectedDisciplineId) {
      setError('Completa los campos requeridos')
      return
    }
    if (!slot1 || !slot2 || !slot3) {
      setError('Debes elegir las 3 fechas y horas para tus 3 sesiones')
      return
    }
    if (new Set([slot1, slot2, slot3]).size !== 3) {
      setError('Las 3 fechas deben ser distintas')
      return
    }
    setIsSubmitting(true)
    try {
      const body = {
        purchaseId: selectedPurchaseId,
        preferredDisciplineId: selectedDisciplineId,
        preferredInstructorId: selectedInstructorId || null,
        preferredSlot1: new Date(slot1).toISOString(),
        preferredSlot2: new Date(slot2).toISOString(),
        preferredSlot3: new Date(slot3).toISOString(),
        notes: notes.trim() || null,
      }
      const res = await fetch('/api/private-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al enviar la solicitud')
        return
      }
      setSuccessMessage(
        '¡Solicitud enviada! Recibirás un correo en cuanto la confirmemos.'
      )
      // Refresh requests list
      const requestsRes = await fetch('/api/private-sessions')
      if (requestsRes.ok) {
        const rd = await requestsRes.json()
        setRequests(rd.requests || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Min datetime = 1 hour from now, formatted for datetime-local input
  const minDateTime = React.useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <Link
          href="/perfil/paquetes"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis paquetes
        </Link>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Sesión Privada
        </h1>
        <p className="text-gray-600 mt-2">
          Coordina tus 3 sesiones 1:1 personalizadas. Elige la disciplina, tu
          instructor preferido (opcional) y las 3 fechas y horas en las que querés
          tomarlas. La admin las revisa y confirma por correo.
        </p>
      </div>

      {/* No private flow purchase */}
      {privatePurchases.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">
              No tienes ningún paquete Private Flow activo.
            </p>
            <Link href="/paquetes">
              <Button>Ver paquetes disponibles</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Existing requests (history + active) */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tus solicitudes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.map((r) => (
              <div key={r.id} className="border border-beige rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString('es-SV')}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">
                      {r.preferredDiscipline.name}
                      {r.preferredInstructor && ` · ${r.preferredInstructor.name}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.purchase.package.name}
                    </p>
                  </div>
                </div>

                {r.status === 'CONFIRMED' && r.confirmedClasses.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm">
                    <p className="font-medium text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {r.confirmedClasses.length === 1
                        ? 'Sesión confirmada'
                        : `${r.confirmedClasses.length} sesiones confirmadas`}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {r.confirmedClasses.map((c) => (
                        <li key={c.id} className="space-y-0.5">
                          <p className="text-emerald-800">
                            <Calendar className="h-3.5 w-3.5 inline mr-1" />
                            {formatDateTime(c.dateTime)}
                          </p>
                          <p className="text-emerald-800">
                            <User className="h-3.5 w-3.5 inline mr-1" />
                            {c.instructor.name} · {c.discipline.name}
                          </p>
                          <p className="text-emerald-800">
                            <Clock className="h-3.5 w-3.5 inline mr-1" />
                            {c.duration} minutos
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.status === 'PENDING' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
                    <p className="font-medium mb-1">Solicitud pendiente</p>
                    <p className="text-xs">
                      Te contactaremos por correo con la confirmación. Opciones que enviaste:
                    </p>
                    <ul className="mt-2 text-xs space-y-0.5 list-disc list-inside">
                      <li>{formatDateTime(r.preferredSlot1)}</li>
                      {r.preferredSlot2 && <li>{formatDateTime(r.preferredSlot2)}</li>}
                      {r.preferredSlot3 && <li>{formatDateTime(r.preferredSlot3)}</li>}
                    </ul>
                  </div>
                )}

                {r.status === 'REJECTED' && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-900">
                    <p className="font-medium flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" /> No pudimos confirmar
                    </p>
                    {r.rejectedReason && (
                      <p className="text-xs mt-1">{r.rejectedReason}</p>
                    )}
                    <p className="text-xs mt-1">
                      Tu paquete sigue activo. Puedes enviar una nueva solicitud.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Success message after submit */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
          <p className="font-medium flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> {successMessage}
          </p>
        </div>
      )}

      {/* Explainer when the form is hidden because the user already has an
          active request on every private package they own */}
      {!showForm && !successMessage && privatePurchases.length > 0 && activeRequest && (
        <Card>
          <CardContent className="py-6 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {activeRequest.status === 'PENDING'
                ? 'Ya tienes una solicitud pendiente'
                : activeRequest.confirmedClasses.length > 1
                ? 'Tus sesiones están confirmadas'
                : 'Tu sesión está confirmada'}
            </p>
            <p>
              {activeRequest.status === 'PENDING'
                ? 'Estamos coordinando tus sesiones privadas. Cuando las confirmemos o rechacemos podrás enviar una nueva solicitud usando este paquete.'
                : activeRequest.confirmedClasses.length > 1
                ? 'Revisa los detalles arriba. Cuando tomes tus sesiones podrás solicitar otras si compras un nuevo paquete Private Flow.'
                : 'Revisa los detalles arriba. Cuando tomes esta sesión podrás solicitar otra si compras un nuevo paquete Private Flow.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Request form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Nueva solicitud</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Purchase picker (only if multiple) */}
              {availablePurchases.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Paquete a usar
                  </label>
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => setSelectedPurchaseId(e.target.value)}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {availablePurchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packageName} · {p.classesRemaining} clase
                        {p.classesRemaining !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Disciplina <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDisciplineId}
                  onChange={(e) => setSelectedDisciplineId(e.target.value)}
                  className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Selecciona una disciplina</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Instructor preferido <span className="text-gray-400">(opcional)</span>
                </label>
                <select
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sin preferencia</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  Tus 3 sesiones
                </label>
                <p className="text-xs text-gray-500 -mt-2">
                  Estas serán las fechas y horas reales de tus 3 sesiones privadas. La admin las revisa y confirma.
                </p>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot1}
                    onChange={(e) => setSlot1(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 2 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot2}
                    onChange={(e) => setSlot2(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 3 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot3}
                    onChange={(e) => setSlot3(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Notas <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Cuéntanos qué te gustaría trabajar en esta sesión, objetivos, limitaciones, etc."
                  className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/perfil/paquetes')}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                  Enviar solicitud
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
    CONFIRMED: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'No confirmada', className: 'bg-red-100 text-red-800' },
    CANCELLED: { label: 'Cancelada', className: 'bg-gray-100 text-gray-700' },
  }
  const c = config[status] || config.PENDING
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.label}
    </span>
  )
}
