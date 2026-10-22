import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { localInputFromDate, type EventFormInput } from '@/lib/events/eventForm'
import { EventForm } from '../../EventForm'

export const dynamic = 'force-dynamic'

export default async function EditarEventoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = await prisma.event.findUnique({ where: { slug } })
  if (!e) notFound()
  const initial: EventFormInput = {
    name: e.name, slug: e.slug, startsAtLocal: localInputFromDate(e.startsAt), endsAtLocal: localInputFromDate(e.endsAt),
    venue: e.venue, priceDollars: e.priceCents / 100, capacity: e.capacity, summary: e.summary, description: e.description,
    imageUrl: e.imageUrl ?? '', codePrefix: e.codePrefix, theme: e.theme === 'villains' ? 'villains' : 'wellnest',
    ticketsEnabled: e.ticketsEnabled, isActive: e.isActive, salesOpen: e.salesOpen, thanksMessage: e.thanksMessage ?? '', pagePath: e.pagePath ?? '',
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-foreground">Editar · {e.name}</h1>
      <EventForm initial={initial} eventId={e.id} />
    </div>
  )
}
