'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, Loader2, Pencil, ListOrdered, ExternalLink, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { AdminEventRow } from '@/lib/events/adminEvents'

const dt = (iso: string) =>
  new Date(iso).toLocaleString('es-SV', { timeZone: 'America/El_Salvador', dateStyle: 'medium', timeStyle: 'short' })

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-gray-700">{label}</span>
    </label>
  )
}

export default function AdminEventosPage() {
  const [events, setEvents] = React.useState<AdminEventRow[] | null>(null)
  const [error, setError] = React.useState('')
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/eventos')
      const data: { events?: AdminEventRow[]; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.events) { setError(data.error ?? `Error ${res.status} cargando eventos`); return }
      setEvents(data.events)
      setError('')
    } catch {
      setError('No se pudo conectar. Recargá la página.')
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function setFlag(id: string, flags: { isActive?: boolean; salesOpen?: boolean }) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/eventos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flags) })
      if (!res.ok) { const d: { error?: string } = await res.json().catch(() => ({})); setError(d.error ?? 'No se pudo guardar') }
      await load()
    } catch {
      setError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">Eventos</h1>
          <p className="mt-1 text-gray-600">Los eventos visibles aparecen en wellneststudio.net/eventos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/eventos/checkin"><ScanLine className="mr-2 h-4 w-4" />Check-in</Link></Button>
          <Button asChild size="sm"><Link href="/admin/eventos/nuevo"><Plus className="mr-2 h-4 w-4" />Nuevo evento</Link></Button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-[var(--color-error)]/10 p-3 text-sm text-[var(--color-error)]">{error}</p>}

      {!events ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-gray-500">Todavía no hay eventos.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {events.map((e) => {
            const ended = new Date(e.endsAt).getTime() < Date.now()
            return (
              <Card key={e.id}>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-medium text-foreground">{e.name}</h2>
                      {ended ? <Badge variant="outline">Terminó</Badge> : e.isActive ? <Badge variant="success">Visible</Badge> : <Badge variant="warning">Oculto</Badge>}
                      {!e.ticketsEnabled && <Badge variant="secondary">Sin venta de entradas</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{dt(e.startsAt)} · {e.venue} · ${(e.priceCents / 100).toFixed(2)}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {e.paidTickets} pagadas · {e.pendingTickets} pendientes · {e.checkedIn} adentro{e.capacity !== null ? ` · cupo ${e.capacity}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 lg:items-end">
                    <div className="flex flex-wrap gap-5">
                      <Toggle label="Visible en el sitio" checked={e.isActive} disabled={busyId === e.id} onChange={(v) => setFlag(e.id, { isActive: v })} />
                      {e.ticketsEnabled && <Toggle label="Venta abierta" checked={e.salesOpen} disabled={busyId === e.id} onChange={(v) => setFlag(e.id, { salesOpen: v })} />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {e.ticketsEnabled && <Button asChild size="sm" variant="secondary"><Link href={`/admin/eventos/${e.slug}`}><ListOrdered className="mr-1 h-4 w-4" />Pedidos</Link></Button>}
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/eventos/${e.slug}/editar`}><Pencil className="mr-1 h-4 w-4" />Editar</Link></Button>
                      <Button asChild size="sm" variant="ghost"><a href={e.pagePath ?? `/eventos/${e.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Ver página</a></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
