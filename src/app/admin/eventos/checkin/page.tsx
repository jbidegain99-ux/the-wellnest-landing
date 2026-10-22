'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { QRScanner } from '@/components/QRScanner'
import type { AdminEventRow } from '@/lib/events/adminEvents'
import type { CheckInResult, TicketSearchRow } from '@/lib/events/checkin'

type Result = Omit<CheckInResult, 'checkedInAt'> & { checkedInAt?: string }

const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador', hour: 'numeric', minute: '2-digit' }).toUpperCase()

const C = { ink: '#0D0908', cream: '#EFE6D6', muted: '#CDBFA8', green: '#1E5A3A', red: '#4A0D13', crimson: '#8E1A24' }

export default function CheckinPage() {
  return (
    <React.Suspense fallback={null}>
      <CheckinScreen />
    </React.Suspense>
  )
}

function CheckinScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const [events, setEvents] = React.useState<AdminEventRow[]>([])
  const evento = params.get('evento') ?? ''
  const [inside, setInside] = React.useState<number | null>(null)
  const [result, setResult] = React.useState<Result | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [netError, setNetError] = React.useState('')
  const [undoUntil, setUndoUntil] = React.useState(0)
  const [query, setQuery] = React.useState('')
  const [rows, setRows] = React.useState<TicketSearchRow[]>([])
  const [, tick] = React.useState(0)
  const [searchNonce, setSearchNonce] = React.useState(0)

  // Eventos con venta, el próximo primero; sin ?evento= se elige el próximo
  React.useEffect(() => {
    fetch('/api/admin/eventos')
      .then((r) => r.json())
      .then((d: { events?: AdminEventRow[] }) => {
        const list = (d.events ?? []).filter((e) => e.ticketsEnabled && new Date(e.endsAt).getTime() > Date.now() - 24 * 3600 * 1000)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        setEvents(list)
        if (!evento && list[0]) router.replace(`/admin/eventos/checkin?evento=${list[0].slug}`)
      })
      .catch(() => {})
  }, [evento, router])

  React.useEffect(() => {
    if (!evento) return
    fetch(`/api/admin/eventos/buscar?q=&evento=${encodeURIComponent(evento)}`).then((r) => r.json()).then((d: { inside?: number }) => setInside(d.inside ?? null)).catch(() => {})
  }, [evento])
  const current = events.find((e) => e.slug === evento)

  // Re-render para que "Deshacer" desaparezca a los 30 s
  React.useEffect(() => {
    if (!undoUntil) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [undoUntil])

  React.useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setRows([]); return }
    const t = setTimeout(() => {
      fetch(`/api/admin/eventos/buscar?q=${encodeURIComponent(term)}&evento=${encodeURIComponent(evento)}`)
        .then((r) => r.json())
        .then((d: { results?: TicketSearchRow[] }) => setRows(d.results ?? []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query, searchNonce, evento])

  async function submit(payload: { scanned: string } | { ticketId: string }) {
    if (busy) return
    setBusy(true)
    setNetError('')
    try {
      const res = await fetch('/api/admin/eventos/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, evento }),
      })
      if (!res.ok) { setNetError(res.status === 401 ? 'Tu sesión de admin expiró. Volvé a iniciar sesión.' : `Error ${res.status}. Probá de nuevo.`); return }
      const d: { result: Result; inside: number } = await res.json()
      setResult(d.result)
      setInside(d.inside)
      setUndoUntil(d.result.kind === 'admitted' ? Date.now() + 30_000 : 0)
      setSearchNonce((n) => n + 1) // refresca resultados de búsqueda
    } catch {
      setNetError('Sin conexión. Usá la lista impresa y anotá a mano.')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (!result?.ticketId) return
    const res = await fetch('/api/admin/eventos/checkin', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: result.ticketId, evento }),
    })
    const d: { undone?: boolean; inside?: number } = await res.json().catch(() => ({}))
    if (d.undone) { setResult(null); setUndoUntil(0) }
    if (typeof d.inside === 'number') setInside(d.inside)
  }

  const canUndo = undoUntil > Date.now()

  return (
    <div className="-m-6 min-h-screen lg:-m-8" style={{ background: C.ink, color: C.cream, fontFamily: 'Georgia, serif' }}>
      <div className="mx-auto flex max-w-[440px] flex-col">
        <header className="flex items-center justify-between border-b border-[#3A2C24] px-5 py-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold tracking-[0.26em]" style={{ color: C.muted }}>PUERTA</span>
            {events.length > 1 ? (
              <select
                aria-label="Evento"
                value={evento}
                onChange={(e) => { setResult(null); router.replace(`/admin/eventos/checkin?evento=${e.target.value}`) }}
                className="mt-1 max-w-[220px] bg-transparent text-[18px] outline-none"
              >
                {events.map((e) => <option key={e.slug} value={e.slug} style={{ color: '#000' }}>{e.name}</option>)}
              </select>
            ) : (
              <span className="text-[18px]">{current?.name ?? '…'}</span>
            )}
          </div>
          <div className="text-right">
            <div className="text-[22px]">{inside ?? '—'}</div>
            <div className="text-[13px]" style={{ color: C.muted }}>adentro</div>
          </div>
        </header>

        {!result ? (
          <div className="bg-[#1A1210]">
            <QRScanner isActive={!busy} onScan={(text) => submit({ scanned: text })} />
            <p className="py-2 text-center text-[14px]" style={{ color: C.muted }}>Apuntá la cámara al QR de la invitación</p>
          </div>
        ) : (
          <section
            aria-live="assertive"
            className="m-4 flex flex-col items-center gap-[6px] px-5 py-5 text-center"
            style={{ background: result.kind === 'admitted' ? C.green : C.red, border: result.kind === 'admitted' ? 'none' : `1px solid ${C.crimson}` }}
          >
            <span className="text-[30px] font-bold tracking-[0.16em]">
              {result.kind === 'admitted' && '✓ ADMITIDO'}
              {result.kind === 'already' && `YA INGRESÓ${result.checkedInAt ? ' · ' + hm(result.checkedInAt) : ''}`}
              {result.kind === 'unknown' && 'QR NO RECONOCIDO'}
              {result.kind === 'cancelled' && 'INVITACIÓN ANULADA'}
              {result.kind === 'wrong-event' && 'ES DE OTRO EVENTO'}
            </span>
            {result.kind === 'wrong-event' && result.eventName && <span className="text-[18px]">Esta entrada es para {result.eventName}</span>}
            {result.holderLabel && <span className="text-[26px] italic">{result.holderLabel}</span>}
            {result.label && <span className="text-[16px]">Invitación {result.seq} de {result.quantity} · {result.label}</span>}
            {result.kind === 'admitted' && <span className="text-[15px] text-[#D5E6DA]">Pago confirmado por transferencia</span>}
            <button type="button" onClick={() => { setResult(null); setUndoUntil(0) }}
              className="mt-3 h-[50px] w-full text-[12px] font-bold tracking-[0.2em]" style={{ background: C.cream, color: C.ink }}>
              ESCANEAR SIGUIENTE
            </button>
            {canUndo && (
              <button type="button" onClick={undo} className="min-h-[44px] text-[14px] underline">Deshacer (fue un error)</button>
            )}
          </section>
        )}

        {netError && <p role="alert" className="mx-4 mt-2 p-3 text-[15px]" style={{ background: C.red }}>{netError}</p>}

        <section className="m-4 flex flex-col gap-2">
          <label htmlFor="buscar" className="text-[10px] font-semibold tracking-[0.24em]" style={{ color: C.muted }}>BUSCAR POR NOMBRE, TELÉFONO O CÓDIGO</label>
          <input id="buscar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ana, 7792, HW-7K3P…"
            className="h-12 border border-[#8C7A6B] bg-transparent px-3 text-[17px] outline-none focus:border-[#EFE6D6]" />
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.ticketId} className="flex items-center justify-between gap-3 border border-[#3A2C24] px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[16px]">{r.holderLabel}</span>
                  <span className="text-[13px]" style={{ color: C.muted }}>{r.label} · {r.buyerPhone}</span>
                </div>
                {r.checkedInAt ? (
                  <span className="text-[13px]" style={{ color: C.muted }}>Adentro · {hm(r.checkedInAt)}</span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => submit({ ticketId: r.ticketId })}
                    className="min-h-[44px] px-4 text-[12px] font-bold tracking-[0.14em]" style={{ background: C.cream, color: C.ink }}>
                    ADMITIR
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
