import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { getPublicEvent as loadPublicEvent } from '@/lib/events/catalog'
import { eventDateSentence } from '@/lib/events/format'
import { EventLanding } from '@/components/evento/EventLanding'
import { getAdminId } from '@/lib/events/admin'

export const dynamic = 'force-dynamic'

const getPublicEvent = cache((slug: string) => loadPublicEvent(slug))

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event || !event.isActive) return { title: 'Evento · Wellnest' }
  const description = `${eventDateSentence(event.startsAt)} · ${event.venue}${event.summary ? `. ${event.summary}` : ''}`
  return {
    title: `${event.name} · Wellnest`,
    description,
    openGraph: {
      title: event.name, description, type: 'website', locale: 'es_SV',
      ...(event.imageUrl ? { images: [{ url: event.imageUrl, alt: event.name }] } : {}),
    },
  }
}

/** Página estándar de un evento. Si tiene landing propia, redirige ahí. Oculto → 404. */
export default async function EventoPage({ params }: Props) {
  const { slug } = await params
  const event = await getPublicEvent(slug)
  if (!event) notFound()
  // Oculto: 404 para el público; el admin lo ve como vista previa
  const preview = !event.isActive
  if (preview && !(await getAdminId())) notFound()
  if (!preview && event.pagePath && event.pagePath !== `/eventos/${slug}`) redirect(event.pagePath)
  return <EventLanding event={event} preview={preview} />
}
