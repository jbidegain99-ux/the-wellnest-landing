'use client'

import * as React from 'react'
import { Check, Clock, Loader2, MessageCircle, Minus, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/Modal'
import { waLink } from '@/lib/events/whatsapp'
import {
  filterFoodOrders,
  foodOrderMessage,
  itemsLabel,
  phoneLabel,
  summarizeFoodOrders,
  usd,
  type FoodFilter,
  type FoodMenu,
  type FoodOrderRow,
} from '@/lib/events/food'

const FILTERS: { id: FoodFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'sin-pagar', label: 'Pago pendiente' },
  { id: 'por-entregar', label: 'Por entregar' },
  { id: 'entregados', label: 'Entregados' },
]

const REFRESH_MS = 20_000

type Form = { id: string | null; name: string; phone: string; note: string; paid: boolean; quantities: Record<string, number> }
type Dialog = { kind: 'form'; form: Form } | { kind: 'delete'; order: FoodOrderRow } | null

const emptyForm = (menu: FoodMenu): Form => ({
  id: null,
  name: '',
  phone: '',
  note: '',
  paid: false,
  quantities: Object.fromEntries(menu.items.map((i) => [i.id, 0])),
})

const formFor = (menu: FoodMenu, o: FoodOrderRow): Form => ({
  id: o.id,
  name: o.customerName,
  phone: o.customerPhone ?? '',
  note: o.note ?? '',
  paid: !!o.paidAt,
  quantities: Object.fromEntries(menu.items.map((i) => [i.id, o.items.find((x) => x.id === i.id)?.qty ?? 0])),
})

async function readError(res: Response): Promise<string> {
  const data: { error?: string } = await res.json().catch(() => ({}))
  return data.error ?? `Error ${res.status}`
}

export function Comida({ slug }: { slug: string }) {
  const [menu, setMenu] = React.useState<FoodMenu | null>(null)
  const [eventName, setEventName] = React.useState('')
  const [orders, setOrders] = React.useState<FoodOrderRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [rowError, setRowError] = React.useState('')
  const [filter, setFilter] = React.useState<FoodFilter>('todos')
  const [query, setQuery] = React.useState('')
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState('')
  // Cada carga o cambio sube el número; una carga vieja que llega tarde se descarta.
  const seq = React.useRef(0)

  const load = React.useCallback(async () => {
    const mine = ++seq.current
    try {
      const res = await fetch(`/api/admin/eventos/comida?${new URLSearchParams({ evento: slug })}`, { cache: 'no-store' })
      if (mine !== seq.current) return
      if (!res.ok) {
        setLoadError(await readError(res))
        return
      }
      const data: { menu: FoodMenu; event: { name: string }; orders: FoodOrderRow[] } = await res.json()
      if (mine !== seq.current) return
      setMenu(data.menu)
      setEventName(data.event.name)
      setOrders(data.orders)
      setLoadError('')
    } catch {
      if (mine === seq.current) setLoadError('No se pudo conectar. Revisá la señal y tocá actualizar.')
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [slug])

  // Varios teléfonos marcan a la vez en el evento: se actualiza solo mientras la pestaña está visible.
  React.useEffect(() => {
    load()
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const id = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  async function patch(order: FoodOrderRow, change: { paid?: boolean; delivered?: boolean }) {
    seq.current++
    setRowError('')
    const now = new Date().toISOString()
    const optimistic: FoodOrderRow = {
      ...order,
      ...(change.paid !== undefined && { paidAt: change.paid ? now : null }),
      ...(change.delivered !== undefined && { deliveredAt: change.delivered ? now : null }),
    }
    setOrders((list) => list.map((o) => (o.id === order.id ? optimistic : o)))
    try {
      const res = await fetch(`/api/admin/eventos/comida/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      })
      if (!res.ok) throw new Error(await readError(res))
      const data: { order: FoodOrderRow } = await res.json()
      seq.current++
      setOrders((list) => list.map((o) => (o.id === order.id ? data.order : o)))
    } catch (e) {
      seq.current++
      setOrders((list) => list.map((o) => (o.id === order.id ? order : o)))
      setRowError(`No se guardó el cambio de ${order.customerName}: ${e instanceof Error ? e.message : 'sin conexión'}`)
    }
  }

  function close() {
    if (busy) return
    setDialog(null)
    setActionError('')
  }

  async function save(form: Form) {
    setBusy(true)
    setActionError('')
    try {
      // Al editar no se manda el pago: lo pudo marcar otra persona mientras tanto (se cambia con el botón).
      const body = { name: form.name, phone: form.phone, note: form.note, quantities: form.quantities, ...(!form.id && { paid: form.paid }) }
      const res = form.id
        ? await fetch(`/api/admin/eventos/comida/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/admin/eventos/comida?${new URLSearchParams({ evento: slug })}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        setActionError(await readError(res))
        return
      }
      setDialog(null)
      await load()
    } catch {
      setActionError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(order: FoodOrderRow) {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/eventos/comida/${order.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        setActionError(await readError(res))
        return
      }
      setDialog(null)
      await load()
    } catch {
      setActionError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !menu) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }
  if (!menu) {
    return <p role="alert" className="rounded-lg bg-white p-4 text-sm text-[var(--color-error)]">{loadError || 'No se pudo cargar la comida.'}</p>
  }

  const summary = summarizeFoodOrders(menu, orders)
  const visible = filterFoodOrders(orders, filter, query)
  const countFor = (f: FoodFilter) => filterFoodOrders(orders, f, '').length
  const form = dialog?.kind === 'form' ? dialog.form : null
  const setForm = (next: Partial<Form>) => form && setDialog({ kind: 'form', form: { ...form, ...next } })
  const formTotal = form ? menu.items.reduce((sum, i) => sum + (form.quantities[i.id] ?? 0) * i.priceCents, 0) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.byItem.map((i) => (
          <Card key={i.id}><CardContent className="p-4"><p className="text-sm text-gray-600">{i.name}</p><p className="text-2xl font-semibold">{i.qty}</p></CardContent></Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Cobrado</p>
            <p className="text-2xl font-semibold">{usd(summary.paidCents)}</p>
            <p className="text-xs text-gray-600">de {usd(summary.totalCents)} · faltan {usd(summary.unpaidCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Entregados</p>
            <p className="text-2xl font-semibold">{summary.deliveredOrders} / {summary.orders}</p>
            <p className="text-xs text-gray-600">pedidos · {summary.burgers} hamburguesas</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 sm:flex-none" onClick={() => { setActionError(''); setDialog({ kind: 'form', form: emptyForm(menu) }) }}>
          <Plus className="mr-2 h-4 w-4" />Registrar pedido
        </Button>
        <Button variant="outline" size="icon" aria-label="Actualizar lista" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pedidos de comida">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === f.id ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-gray-200 bg-white text-gray-600'}`}>
            {f.label} ({countFor(f.id)})
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input aria-label="Buscar pedido de comida" placeholder="Nombre o teléfono" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      {loadError && <p role="alert" className="rounded-lg bg-white p-3 text-sm text-[var(--color-error)]">{loadError}</p>}
      {rowError && <p role="alert" className="rounded-lg bg-white p-3 text-sm text-[var(--color-error)]">{rowError}</p>}

      {visible.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-gray-500">{orders.length === 0 ? 'Todavía no hay pedidos de comida.' : 'Ningún pedido coincide.'}</CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((o) => (
            <li key={o.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{o.customerName}</p>
                      <p className="text-sm text-gray-700">{itemsLabel(o.items)}</p>
                      {o.customerPhone && <p className="text-xs text-gray-500">{phoneLabel(o.customerPhone)}</p>}
                      {o.note && <p className="mt-1 text-sm italic text-gray-600">{o.note}</p>}
                    </div>
                    <p className="shrink-0 text-lg font-semibold">{usd(o.totalCents)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatusToggle
                      label="Pago" done={!!o.paidAt} doneText="Cancelado" pendingText="Pendiente"
                      onClick={() => patch(o, { paid: !o.paidAt })}
                    />
                    <StatusToggle
                      label="Entrega" done={!!o.deliveredAt} doneText="Entregado" pendingText="Pendiente"
                      onClick={() => patch(o, { delivered: !o.deliveredAt })}
                    />
                  </div>
                  <div className="flex justify-end gap-1">
                    {o.customerPhone && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={waLink(foodOrderMessage(menu, o, eventName), o.customerPhone)} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-1 h-4 w-4" />WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setActionError(''); setDialog({ kind: 'form', form: formFor(menu, o) }) }}>
                      <Pencil className="mr-1 h-4 w-4" />Editar
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Borrar pedido de ${o.customerName}`} onClick={() => { setActionError(''); setDialog({ kind: 'delete', order: o }) }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={dialog !== null} onOpenChange={(open) => !open && close()}>
        <ModalContent className="sm:max-w-md">
          {form && (
            <form onSubmit={(e) => { e.preventDefault(); save(form) }} className="space-y-4">
              <ModalHeader>
                <ModalTitle>{form.id ? 'Editar pedido' : 'Registrar pedido'}</ModalTitle>
                <ModalDescription>{menu.vendor} · {usd(menu.items[0]?.priceCents ?? 0)} c/u</ModalDescription>
              </ModalHeader>
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ name: e.target.value })} autoComplete="off" required />
              <Input label="WhatsApp (opcional)" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ phone: e.target.value })} autoComplete="off" />
              <div className="space-y-2">
                {menu.items.map((i) => {
                  const qty = form.quantities[i.id] ?? 0
                  const setQty = (n: number) => setForm({ quantities: { ...form.quantities, [i.id]: Math.max(0, Math.min(50, n)) } })
                  return (
                    <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2 pl-3">
                      <span className="font-medium">{i.name}</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" aria-label={`Quitar una ${i.name}`} onClick={() => setQty(qty - 1)} disabled={qty === 0}><Minus className="h-4 w-4" /></Button>
                        <span className="w-6 text-center text-lg font-semibold" aria-live="polite" aria-label={`${qty} ${i.name}`}>{qty}</span>
                        <Button type="button" variant="outline" size="icon" aria-label={`Agregar una ${i.name}`} onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-right text-lg font-semibold">Total: {usd(formTotal)}</p>
              <Textarea label="Nota (opcional)" value={form.note} onChange={(e) => setForm({ note: e.target.value })} rows={2} />
              {!form.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ paid: e.target.checked })} className="h-4 w-4" />
                  Ya pagó (cancelado)
                </label>
              )}
              {actionError && <p role="alert" className="text-sm text-[var(--color-error)]">{actionError}</p>}
              <ModalFooter>
                <Button type="button" variant="ghost" onClick={close} disabled={busy}>Volver</Button>
                <Button type="submit" isLoading={busy} disabled={formTotal === 0}>{form.id ? 'Guardar' : 'Registrar'}</Button>
              </ModalFooter>
            </form>
          )}
          {dialog?.kind === 'delete' && (
            <>
              <ModalHeader>
                <ModalTitle>Borrar pedido</ModalTitle>
                <ModalDescription>
                  {dialog.order.customerName}: {itemsLabel(dialog.order.items)} ({usd(dialog.order.totalCents)}). No se puede deshacer.
                </ModalDescription>
              </ModalHeader>
              {actionError && <p role="alert" className="text-sm text-[var(--color-error)]">{actionError}</p>}
              <ModalFooter>
                <Button variant="ghost" onClick={close} disabled={busy}>Volver</Button>
                <Button variant="destructive" onClick={() => remove(dialog.order)} isLoading={busy}>Borrar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

function StatusToggle(p: { label: string; done: boolean; doneText: string; pendingText: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={p.done}
      aria-label={`${p.label}: ${p.done ? p.doneText : p.pendingText}`}
      onClick={p.onClick}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 px-3 py-1 text-left ${
        p.done ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-gray-300 bg-white text-gray-800'
      }`}
    >
      {p.done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clock className="h-4 w-4 text-[var(--color-warning)]" aria-hidden="true" />}
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-normal">{p.label}</span>
        <span className="text-sm font-semibold">{p.done ? p.doneText : p.pendingText}</span>
      </span>
    </button>
  )
}
