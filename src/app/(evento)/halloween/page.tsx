import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicEvent } from '@/lib/events/catalog'
import { VILLAINS_BALL_SLUG } from '@/lib/events/config'
import { EventLanding } from '@/components/evento/EventLanding'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Villains Ball · Wellnest',
  description: 'A Halloween Show by Wellnest. Viernes 30 de octubre, 6:30 p. m., Plaza Presidente nivel 3. Entrada general $10.',
  openGraph: {
    title: 'The Villains Ball · A Halloween Show by Wellnest',
    description: 'Viernes 30 de octubre, 6:30 p. m. · Plaza Presidente, nivel 3 · Entrada general $10.',
    type: 'website',
    locale: 'es_SV',
    images: [{ url: '/halloween/invitacion.jpg', width: 900, height: 1125, alt: 'Invitación de The Villains Ball' }],
  },
}

/** Landing propia de The Villains Ball (pagePath = /halloween). */
export default async function HalloweenPage() {
  const event = await getPublicEvent(VILLAINS_BALL_SLUG)
  if (!event) notFound()
  return <EventLanding event={event} />
}
