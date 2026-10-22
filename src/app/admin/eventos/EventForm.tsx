'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import { eventFormInput, slugify, type EventFormInput } from '@/lib/events/eventForm'

export const EMPTY_EVENT: EventFormInput = {
  name: '', slug: '', startsAtLocal: '', endsAtLocal: '', venue: 'Wellnest Studio', priceDollars: 10, capacity: null,
  summary: '', description: '', imageUrl: '', codePrefix: '', theme: 'wellnest', ticketsEnabled: true,
  isActive: false, salesOpen: true, thanksMessage: '', pagePath: '',
}

function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-primary)]" />
      <span><span className="font-medium text-foreground">{label}</span><br /><span className="text-sm text-gray-600">{hint}</span></span>
    </label>
  )
}

/** Formulario de crear/editar evento. `eventId` presente = edición. */
export function EventForm({ initial, eventId }: { initial: EventFormInput; eventId?: string }) {
  const router = useRouter()
  const [v, setV] = React.useState<EventFormInput>(initial)
  const [slugTouched, setSlugTouched] = React.useState(Boolean(eventId))
  const [prefixTouched, setPrefixTouched] = React.useState(Boolean(eventId))
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  function set<K extends keyof EventFormInput>(key: K, value: EventFormInput[K]) {
    setV((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'name' && typeof value === 'string') {
        if (!slugTouched) next.slug = slugify(value)
        if (!prefixTouched) {
          const initials = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3)
          next.codePrefix = initials.length >= 2 ? `${initials}-` : prev.codePrefix
        }
      }
      return next
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const parsed = eventFormInput.safeParse(v)
    if (!parsed.success) { setError(parsed.error.errors[0]?.message ?? 'Revisá los datos'); return }
    setSaving(true)
    try {
      const res = await fetch(eventId ? `/api/admin/eventos/${eventId}` : '/api/admin/eventos', {
        method: eventId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
      })
      const data: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      router.push('/admin/eventos')
      router.refresh()
    } catch {
      setError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card><CardContent className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Nombre del evento" value={v.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <Input label="Identificador (URL: /eventos/…)" value={v.slug} disabled={Boolean(eventId)} title={eventId ? 'No se cambia después de crear: rompería enlaces y entradas' : undefined} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} />
        <Input label="Prefijo del código de pedido (ej. VP-)" value={v.codePrefix} onChange={(e) => { setPrefixTouched(true); set('codePrefix', e.target.value.toUpperCase()) }} />
        <Input label="Inicio (hora de El Salvador)" type="datetime-local" value={v.startsAtLocal} onChange={(e) => set('startsAtLocal', e.target.value)} />
        <Input label="Fin (hora de El Salvador)" type="datetime-local" value={v.endsAtLocal} onChange={(e) => set('endsAtLocal', e.target.value)} />
        <div className="sm:col-span-2"><Input label="Lugar" value={v.venue} onChange={(e) => set('venue', e.target.value)} /></div>
        <Input label="Precio por entrada (USD)" type="number" min={0} step="0.01" value={String(v.priceDollars)} onChange={(e) => set('priceDollars', Number(e.target.value))} />
        <Input label="Cupo (vacío = sin tope)" type="number" min={1} step="1" value={v.capacity === null ? '' : String(v.capacity)} onChange={(e) => set('capacity', e.target.value === '' ? null : Math.floor(Number(e.target.value)))} />
      </CardContent></Card>

      <Card><CardContent className="grid gap-4 p-6">
        <Input label="Resumen (tarjeta de /eventos, máx. 200)" value={v.summary} maxLength={200} onChange={(e) => set('summary', e.target.value)} />
        <Textarea label="Descripción (separá párrafos con una línea en blanco)" rows={6} value={v.description} onChange={(e) => set('description', e.target.value)} />
        <Input label="Imagen de portada (URL https:// o ruta /…)" value={v.imageUrl} placeholder="https://res.cloudinary.com/…" onChange={(e) => set('imageUrl', e.target.value)} />
        {v.imageUrl && (v.imageUrl.startsWith('/') || v.imageUrl.startsWith('https://')) && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={v.imageUrl} alt="Vista previa de la portada" className="h-40 w-full rounded-lg object-cover" />
        )}
        <Textarea label="Mensaje de agradecimiento (carta después del evento; vacío = genérico)" rows={3} value={v.thanksMessage} onChange={(e) => set('thanksMessage', e.target.value)} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Estilo de las páginas del evento</legend>
          <label className="flex items-center gap-2"><input type="radio" name="theme" checked={v.theme === 'wellnest'} onChange={() => set('theme', 'wellnest')} /> Wellnest (claro, colores del sitio)</label>
          <label className="flex items-center gap-2"><input type="radio" name="theme" checked={v.theme === 'villains'} onChange={() => set('theme', 'villains')} /> Noir (como The Villains Ball)</label>
        </fieldset>
      </CardContent></Card>

      <Card><CardContent className="grid gap-4 p-6">
        <Check label="Vende entradas" hint="Si lo desmarcás, la página es solo informativa con un botón de WhatsApp." checked={v.ticketsEnabled} onChange={(x) => set('ticketsEnabled', x)} />
        <Check label="Venta abierta" hint="Podés cerrar la venta sin ocultar el evento." checked={v.salesOpen} onChange={(x) => set('salesOpen', x)} />
        <Check label="Visible en el sitio" hint="Aparece en /eventos y permite comprar. Si lo ocultás, también se cierra la venta. Desactivalo cuando el evento termine." checked={v.isActive} onChange={(x) => set('isActive', x)} />
        <Input label="Landing propia (avanzado, ej. /halloween; vacío = /eventos/identificador)" value={v.pagePath} onChange={(e) => set('pagePath', e.target.value)} />
      </CardContent></Card>

      {error && <p role="alert" className="rounded-lg bg-[var(--color-error)]/10 p-3 text-sm text-[var(--color-error)]">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" isLoading={saving}>{eventId ? 'Guardar cambios' : 'Crear evento'}</Button>
        <Button asChild variant="ghost"><Link href="/admin/eventos">Cancelar</Link></Button>
      </div>
    </form>
  )
}
