import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, MapPin } from 'lucide-react'
import { listActiveEvents, canBuy, type PublicEvent } from '@/lib/events/catalog'
import { eventDateSentence, eventHref, partitionEvents } from '@/lib/events/format'

export const metadata: Metadata = {
  title: 'Eventos | Wellnest',
  description: 'Shows, talleres y experiencias especiales de Wellnest en San Salvador.',
}

export const dynamic = 'force-dynamic'

function EventCard({ event, past }: { event: PublicEvent; past: boolean }) {
  const open = canBuy(event)
  const badge = past ? 'Finalizado' : open ? `Entrada $${(event.priceCents / 100).toFixed(event.priceCents % 100 ? 2 : 0)}` : event.ticketsEnabled ? 'Venta cerrada' : 'Próximamente'
  return (
    <Link
      href={eventHref(event)}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-beige bg-white transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${past ? 'opacity-75' : ''}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-beige">
        {event.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl font-medium text-primary">{event.name.charAt(0)}</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground">{badge}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-xl font-medium text-foreground">{event.name}</h2>
        <p className="flex items-center gap-2 text-sm text-gray-600"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />{eventDateSentence(event.startsAt)}</p>
        <p className="flex items-center gap-2 text-sm text-gray-600"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />{event.venue}</p>
        {event.summary && <p className="mt-1 line-clamp-3 text-gray-600">{event.summary}</p>}
        <span className="mt-auto pt-3 text-sm font-medium text-primary group-hover:underline">{past ? 'Ver evento' : open ? 'Ver evento y comprar entrada →' : 'Ver evento →'}</span>
      </div>
    </Link>
  )
}

export default async function EventosPage() {
  const { upcoming, past } = partitionEvents(await listActiveEvents(), new Date())

  return (
    <>
      <section className="bg-gradient-to-b from-beige to-cream pb-12 pt-32">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="mb-6 text-4xl font-medium text-foreground sm:text-5xl md:text-6xl">Eventos</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 sm:text-xl">
            Shows, talleres y experiencias especiales para vivir el movimiento fuera de la clase.
          </p>
        </div>
      </section>
      <section className="bg-cream pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {upcoming.length === 0 ? (
            <p className="rounded-2xl border border-beige bg-white p-10 text-center text-gray-600">
              Pronto anunciaremos nuevos eventos. Seguinos en Instagram para enterarte primero.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((e) => <EventCard key={e.id} event={e} past={false} />)}
            </div>
          )}
          {past.length > 0 && (
            <>
              <h2 className="mb-6 mt-14 text-2xl font-medium text-foreground">Eventos pasados</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((e) => <EventCard key={e.id} event={e} past />)}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}
