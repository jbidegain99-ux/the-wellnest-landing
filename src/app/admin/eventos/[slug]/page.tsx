'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Search, Download, Loader2, ScanLine, Printer, MessageCircle, Check, X, Ticket as TicketIcon, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/Modal'
import type { AdminOrderRow, AdminCounts, AdminTab } from '@/lib/events/admin'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'pagados', label: 'Pagados' },
  { id: 'otros', label: 'Anulados' },
]

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`
const dt = (iso: string) =>
  new Date(iso).toLocaleString('es-SV', { timeZone: 'America/El_Salvador', dateStyle: 'short', timeStyle: 'short' })
const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador', hour: 'numeric', minute: '2-digit' })

type Dialog =
  | { kind: 'confirm'; order: AdminOrderRow }
  | { kind: 'confirmed'; order: AdminOrderRow; whatsappUrl: string; overCapacity: boolean; emailSent: boolean }
  | { kind: 'cancel'; order: AdminOrderRow }
  | { kind: 'tickets'; order: AdminOrderRow }
  | null

export default function AdminEventoPedidosPage() {
  const { slug } = useParams<{ slug: string }>()
  const [eventInfo, setEventInfo] = React.useState<{ name: string; startsAt: string; venue: string } | null>(null)
  const [tab, setTab] = React.useState<AdminTab>('pendientes')
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [orders, setOrders] = React.useState<AdminOrderRow[]>([])
  const [counts, setCounts] = React.useState<AdminCounts | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState('')
  const [note, setNote] = React.useState('')
  const seq = React.useRef(0)

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const load = React.useCallback(async () => {
    const mine = ++seq.current
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/admin/eventos/pedidos?${new URLSearchParams({ evento: slug, tab, q: debounced })}`)
      if (mine !== seq.current) return
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}))
        setLoadError(data.error ?? `Error ${res.status} cargando los pedidos`)
        return
      }
      const data: { orders: AdminOrderRow[]; counts: AdminCounts; event: { name: string; startsAt: string; venue: string } } = await res.json()
      setOrders(data.orders)
      setCounts(data.counts)
      setEventInfo(data.event)
    } catch {
      if (mine === seq.current) setLoadError('No se pudo conectar. Recargá la página.')
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [slug, tab, debounced])

  React.useEffect(() => { load() }, [load])

  function close() {
    setDialog(null)
    setActionError('')
    setNote('')
  }

  async function confirm(order: AdminOrderRow) {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/eventos/pedidos/${order.id}/confirmar`, { method: 'POST' })
      const data: { error?: string; whatsappUrl?: string; overCapacity?: boolean; emailSent?: boolean } = await res.json().catch(() => ({}))
      if (!res.ok || !data.whatsappUrl) {
        setActionError(data.error ?? 'No se pudo confirmar')
        if (res.status === 409) load()
        return
      }
      setDialog({ kind: 'confirmed', order, whatsappUrl: data.whatsappUrl, overCapacity: !!data.overCapacity, emailSent: !!data.emailSent })
      load()
    } finally {
      setBusy(false)
    }
  }

  async function cancel(order: AdminOrderRow) {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/eventos/pedidos/${order.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const data: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'No se pudo anular')
        return
      }
      close()
      load()
    } finally {
      setBusy(false)
    }
  }

  function sendWhatsapp(orderId: string, url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
    fetch(`/api/admin/eventos/pedidos/${orderId}/whatsapp`, { method: 'POST' }).then(() => load()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/eventos" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-foreground"><ArrowLeft className="h-4 w-4" />Eventos</Link>
          <h1 className="font-serif text-3xl font-semibold text-foreground">{eventInfo?.name ?? '…'}</h1>
          <p className="mt-1 text-gray-600">Pedidos por transferencia{eventInfo ? ` · ${dt(eventInfo.startsAt)} · ${eventInfo.venue}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href={`/admin/eventos/checkin?evento=${slug}`}><ScanLine className="mr-2 h-4 w-4" />Check-in</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={`/admin/eventos/${slug}/lista`}><Printer className="mr-2 h-4 w-4" />Lista imprimible</Link></Button>
          <Button asChild variant="outline" size="sm"><a href={`/api/admin/eventos/export?evento=${slug}`}><Download className="mr-2 h-4 w-4" />Exportar CSV</a></Button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Entradas pagadas', String(counts.paidTickets)],
            ['Pendientes', String(counts.pendingTickets)],
            ['Adentro', String(counts.checkedIn)],
            ['Cupo', counts.capacity === null ? 'Sin tope' : `${counts.paidTickets + counts.pendingTickets} / ${counts.capacity}`],
          ].map(([label, value]) => (
            <Card key={label}><CardContent className="p-4"><p className="text-sm text-gray-600">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-full bg-beige p-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input aria-label="Buscar pedidos" placeholder="Código, nombre, correo o teléfono" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loadError && <p role="alert" className="rounded-lg bg-[var(--color-error)]/10 p-3 text-sm text-[var(--color-error)]">{loadError}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading && orders.length === 0 ? (
            <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : orders.length === 0 ? (
            <p className="p-10 text-center text-gray-500">No hay pedidos en esta pestaña.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-beige/50 text-left text-gray-600">
                <tr><th className="p-3">Código</th><th className="p-3">Comprador</th><th className="p-3">Cant.</th><th className="p-3">Monto</th><th className="p-3">Fecha</th><th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="p-3 font-mono font-semibold">{o.code}</td>
                    <td className="p-3"><div className="font-medium">{o.buyerName}</div><div className="text-xs text-gray-500">{o.buyerPhone} · {o.buyerEmail}</div></td>
                    <td className="p-3">{o.quantity}</td>
                    <td className="p-3">{usd(o.amountCents)}</td>
                    <td className="p-3 text-gray-600">{dt(o.paidAt ?? o.createdAt)}</td>
                    <td className="p-3">
                      {o.status === 'PAID' ? <Badge variant="success">Pagado{o.whatsappSentAt ? ' · WhatsApp ✓' : ''}</Badge>
                        : o.status === 'CANCELLED' ? <Badge variant="error" title={o.adminNote ?? undefined}>Anulado</Badge>
                        : <Badge>Pendiente</Badge>}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {o.status === 'PENDING' && <Button size="sm" onClick={() => setDialog({ kind: 'confirm', order: o })}><Check className="mr-1 h-4 w-4" />Confirmar pago</Button>}
                        {o.status === 'PAID' && o.whatsappUrl && <Button size="sm" variant="secondary" onClick={() => sendWhatsapp(o.id, o.whatsappUrl as string)}><MessageCircle className="mr-1 h-4 w-4" />{o.whatsappSentAt ? 'Reenviar' : 'WhatsApp'}</Button>}
                        {o.status === 'PAID' && <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'tickets', order: o })}><TicketIcon className="mr-1 h-4 w-4" />Entradas</Button>}
                        {o.status !== 'CANCELLED' && <Button size="sm" variant="ghost" aria-label={o.status === 'PAID' ? 'Anular pedido' : 'Cancelar pedido'} onClick={() => setDialog({ kind: 'cancel', order: o })}><X className="h-4 w-4" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={dialog !== null} onOpenChange={(open) => !open && !busy && close()}>
        <ModalContent className="sm:max-w-md">
          {dialog?.kind === 'confirm' && (
            <>
              <ModalHeader>
                <ModalTitle>Confirmar pago</ModalTitle>
                <ModalDescription>
                  ¿Viste <strong>{usd(dialog.order.amountCents)}</strong> con concepto <strong>{dialog.order.code}</strong> en el banco?
                </ModalDescription>
              </ModalHeader>
              <p className="text-sm text-gray-600">{dialog.order.buyerName} · {dialog.order.quantity} entrada{dialog.order.quantity > 1 ? 's' : ''}</p>
              {actionError && <p role="alert" className="text-sm text-[var(--color-error)]">{actionError}</p>}
              <ModalFooter>
                <Button variant="ghost" onClick={close} disabled={busy}>Todavía no</Button>
                <Button onClick={() => confirm(dialog.order)} isLoading={busy}>Sí, confirmar</Button>
              </ModalFooter>
            </>
          )}
          {dialog?.kind === 'confirmed' && (
            <>
              <ModalHeader>
                <ModalTitle>Pago confirmado · {dialog.order.code}</ModalTitle>
                <ModalDescription>Ahora mandale su invitación por WhatsApp.{dialog.emailSent ? ' También le llegó por correo.' : ' El correo no se pudo enviar.'}</ModalDescription>
              </ModalHeader>
              {dialog.overCapacity && <p className="rounded-lg bg-[var(--color-warning)]/10 p-3 text-sm">Atención: con este pedido el evento pasa el cupo.</p>}
              <ModalFooter>
                <Button variant="ghost" onClick={close}>Cerrar</Button>
                <Button onClick={() => { sendWhatsapp(dialog.order.id, dialog.whatsappUrl); close() }}><MessageCircle className="mr-2 h-4 w-4" />Enviar por WhatsApp</Button>
              </ModalFooter>
            </>
          )}
          {dialog?.kind === 'cancel' && (
            <>
              <ModalHeader>
                <ModalTitle>{dialog.order.status === 'PAID' ? 'Anular pedido pagado' : 'Cancelar pedido'} · {dialog.order.code}</ModalTitle>
                <ModalDescription>
                  {dialog.order.status === 'PAID'
                    ? 'Sus entradas dejan de servir en la puerta. Escribí el motivo (error, reembolso…).'
                    : 'El pedido deja de apartar lugares.'}
                </ModalDescription>
              </ModalHeader>
              <Textarea label={dialog.order.status === 'PAID' ? 'Motivo (obligatorio)' : 'Nota (opcional)'} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              {actionError && <p role="alert" className="text-sm text-[var(--color-error)]">{actionError}</p>}
              <ModalFooter>
                <Button variant="ghost" onClick={close} disabled={busy}>Volver</Button>
                <Button variant="destructive" onClick={() => cancel(dialog.order)} isLoading={busy}>{dialog.order.status === 'PAID' ? 'Anular' : 'Cancelar pedido'}</Button>
              </ModalFooter>
            </>
          )}
          {dialog?.kind === 'tickets' && (
            <>
              <ModalHeader><ModalTitle>Entradas · {dialog.order.code}</ModalTitle></ModalHeader>
              <ul className="divide-y text-sm">
                {dialog.order.tickets.map((t) => (
                  <li key={t.seq} className="flex justify-between gap-3 py-2">
                    <span className="font-mono">{t.label}</span>
                    <span className="text-right text-gray-600">
                      {t.checkedInAt ? `Adentro · ${hm(t.checkedInAt)}` : t.claimed ? `Reclamada por ${t.holderName ?? '—'}` : 'Sin reclamar'}
                    </span>
                  </li>
                ))}
              </ul>
              <ModalFooter><Button variant="ghost" onClick={close}>Cerrar</Button></ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
