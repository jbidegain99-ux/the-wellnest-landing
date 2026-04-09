'use client'

import * as React from 'react'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Phone,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Discipline {
  id: string
  name: string
}
interface Instructor {
  id: string
  name: string
}

interface RequestItem {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
  preferredSlot1: string
  preferredSlot2: string | null
  preferredSlot3: string | null
  notes: string | null
  createdAt: string
  confirmedAt: string | null
  rejectedReason: string | null
  adminNotes: string | null
  user: { id: string; name: string | null; email: string; phone: string | null }
  purchase: {
    id: string
    classesRemaining: number
    expiresAt: string
    package: { name: string; price: number }
  }
  preferredDiscipline: { id: string; name: string; slug: string }
  preferredInstructor: { id: string; name: string } | null
  confirmedClass: {
    dateTime: string
    duration: number
    discipline: { name: string }
    instructor: { name: string }
  } | null
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-SV', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

export default function AdminSesionesPrivadasPage() {
  const [requests, setRequests] = React.useState<RequestItem[]>([])
  const [countsByStatus, setCountsByStatus] = React.useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>('PENDING')
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [instructors, setInstructors] = React.useState<Instructor[]>([])

  // Modal state for confirm/reject
  const [openRequestId, setOpenRequestId] = React.useState<string | null>(null)
  const [modalMode, setModalMode] = React.useState<'confirm' | 'reject' | null>(null)

  const fetchRequests = React.useCallback(async (status: string) => {
    setIsLoading(true)
    try {
      const url = new URL('/api/admin/private-sessions', window.location.origin)
      if (status) url.searchParams.set('status', status)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Error al cargar solicitudes')
      const data = await res.json()
      setRequests(data.requests || [])
      setCountsByStatus(data.countsByStatus || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchRequests(statusFilter)
  }, [fetchRequests, statusFilter])

  React.useEffect(() => {
    async function loadOptions() {
      const [d, i] = await Promise.all([fetch('/api/disciplines'), fetch('/api/instructors')])
      if (d.ok) {
        const dd = await d.json()
        setDisciplines(Array.isArray(dd) ? dd : dd.disciplines || [])
      }
      if (i.ok) {
        const ii = await i.json()
        setInstructors(Array.isArray(ii) ? ii : ii.instructors || [])
      }
    }
    loadOptions()
  }, [])

  const openRequest = requests.find((r) => r.id === openRequestId) || null

  function closeModal() {
    setOpenRequestId(null)
    setModalMode(null)
  }

  async function handleAction(payload: object) {
    if (!openRequestId) return
    try {
      const res = await fetch(`/api/admin/private-sessions/${openRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al procesar')
        return
      }
      closeModal()
      await fetchRequests(statusFilter)
    } catch {
      alert('Error de conexión')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Sesiones Privadas
        </h1>
        <p className="text-gray-600 mt-2">
          Solicitudes de sesiones 1:1 pendientes de confirmación.
        </p>
      </div>

      {/* Status filter */}
      <nav className="flex gap-2 bg-white border border-beige rounded-xl p-1 shadow-sm w-fit">
        {(['PENDING', 'CONFIRMED', 'REJECTED'] as const).map((s) => {
          const active = s === statusFilter
          const count = countsByStatus[s] || 0
          const label =
            s === 'PENDING'
              ? 'Pendientes'
              : s === 'CONFIRMED'
              ? 'Confirmadas'
              : 'Rechazadas'
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors ' +
                (active
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-beige')
              }
            >
              {label} {count > 0 && <span className="ml-1 text-xs">({count})</span>}
            </button>
          )
        })}
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No hay solicitudes {statusFilter === 'PENDING' ? 'pendientes' : 'en este estado'}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString('es-SV')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {r.user.name || r.user.email}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {r.user.email}
                        {r.user.phone && (
                          <>
                            <span className="mx-1">·</span>
                            <Phone className="h-3 w-3" /> {r.user.phone}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p>
                        <strong>Disciplina:</strong> {r.preferredDiscipline.name}
                      </p>
                      <p>
                        <strong>Instructor preferido:</strong>{' '}
                        {r.preferredInstructor?.name ?? (
                          <span className="text-gray-500">Sin preferencia</span>
                        )}
                      </p>
                      <p>
                        <strong>Paquete:</strong> {r.purchase.package.name}{' '}
                        ({r.purchase.classesRemaining} clase
                        {r.purchase.classesRemaining !== 1 ? 's' : ''} disponible
                        {r.purchase.classesRemaining !== 1 ? 's' : ''})
                      </p>
                    </div>
                    <div className="text-sm pt-2">
                      <p className="font-medium mb-1">Ventanas preferidas:</p>
                      <ul className="text-gray-700 space-y-0.5 list-disc list-inside text-xs">
                        <li>{formatDateTime(r.preferredSlot1)}</li>
                        {r.preferredSlot2 && <li>{formatDateTime(r.preferredSlot2)}</li>}
                        {r.preferredSlot3 && <li>{formatDateTime(r.preferredSlot3)}</li>}
                      </ul>
                    </div>
                    {r.notes && (
                      <div className="text-sm pt-2">
                        <p className="font-medium mb-1">Notas del cliente:</p>
                        <p className="text-gray-700 text-xs whitespace-pre-wrap bg-beige/50 rounded-md p-2">
                          {r.notes}
                        </p>
                      </div>
                    )}
                    {r.status === 'CONFIRMED' && r.confirmedClass && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm">
                        <p className="font-medium text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Confirmada
                        </p>
                        <p className="text-emerald-800 mt-1">
                          {formatDateTime(r.confirmedClass.dateTime)} ·{' '}
                          {r.confirmedClass.instructor.name} ·{' '}
                          {r.confirmedClass.discipline.name}
                        </p>
                      </div>
                    )}
                    {r.status === 'REJECTED' && r.rejectedReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                        <p className="font-medium text-red-900 flex items-center gap-1.5">
                          <XCircle className="h-4 w-4" /> Rechazada
                        </p>
                        <p className="text-red-800 mt-1 text-xs">{r.rejectedReason}</p>
                      </div>
                    )}
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex lg:flex-col gap-2">
                      <Button
                        onClick={() => {
                          setOpenRequestId(r.id)
                          setModalMode('confirm')
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpenRequestId(r.id)
                          setModalMode('reject')
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {openRequest && modalMode === 'confirm' && (
        <ConfirmModal
          request={openRequest}
          disciplines={disciplines}
          instructors={instructors}
          onClose={closeModal}
          onConfirm={handleAction}
        />
      )}

      {/* Reject modal */}
      {openRequest && modalMode === 'reject' && (
        <RejectModal request={openRequest} onClose={closeModal} onReject={handleAction} />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
    CONFIRMED: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'Rechazada', className: 'bg-red-100 text-red-800' },
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

function ConfirmModal({
  request,
  disciplines,
  instructors,
  onClose,
  onConfirm,
}: {
  request: RequestItem
  disciplines: Discipline[]
  instructors: Instructor[]
  onClose: () => void
  onConfirm: (payload: object) => Promise<void>
}) {
  // Pre-fill from the user's first preferred slot for convenience
  const initialSlot = React.useMemo(() => {
    const d = new Date(request.preferredSlot1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [request.preferredSlot1])

  const [disciplineId, setDisciplineId] = React.useState(request.preferredDiscipline.id)
  const [instructorId, setInstructorId] = React.useState(
    request.preferredInstructor?.id || ''
  )
  const [dateTime, setDateTime] = React.useState(initialSlot)
  const [duration, setDuration] = React.useState(60)
  const [adminNotes, setAdminNotes] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!disciplineId || !instructorId || !dateTime) return
    setIsSubmitting(true)
    await onConfirm({
      action: 'confirm',
      disciplineId,
      instructorId,
      dateTime: new Date(dateTime).toISOString(),
      duration,
      adminNotes: adminNotes.trim() || null,
    })
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-beige">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Confirmar sesión privada
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {request.user.name || request.user.email}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Disciplina <span className="text-red-500">*</span>
            </label>
            <select
              value={disciplineId}
              onChange={(e) => setDisciplineId(e.target.value)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Instructor <span className="text-red-500">*</span>
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Selecciona un instructor</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Fecha y hora final <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Duración (minutos)
            </label>
            <input
              type="number"
              min={15}
              max={180}
              step={15}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notas internas <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              Confirmar y enviar email
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RejectModal({
  request,
  onClose,
  onReject,
}: {
  request: RequestItem
  onClose: () => void
  onReject: (payload: object) => Promise<void>
}) {
  const [reason, setReason] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    await onReject({
      action: 'reject',
      rejectedReason: reason.trim() || null,
    })
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-beige">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Rechazar solicitud
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {request.user.name || request.user.email}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Motivo para el cliente <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej: No tenemos disponibilidad en esas fechas, por favor envía nuevas opciones."
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            El paquete del usuario queda activo y puede enviar otra solicitud.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              Rechazar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
