import { prisma } from '@/lib/prisma'
import { buildEventIcs } from '@/lib/events/ics'
import { siteUrl } from '@/lib/events/config'
import { eventHref } from '@/lib/events/format'

/** GET: archivo .ics para agregar el evento al calendario. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await prisma.event.findUnique({ where: { slug } })
  if (!event || !event.isActive) return new Response('Evento no encontrado', { status: 404 })
  const ics = buildEventIcs({ name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, venue: event.venue, url: `${siteUrl()}${eventHref(event)}`, slug: event.slug })
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="the-${slug}.ics"`,
    },
  })
}
