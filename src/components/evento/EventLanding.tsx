import Link from 'next/link'
import type { PublicEvent } from '@/lib/events/catalog'
import { canBuy } from '@/lib/events/catalog'
import { eventDateSentence, eventTheme } from '@/lib/events/format'
import { EVENT_STUDIO_WHATSAPP } from '@/lib/events/config'
import { waLink } from '@/lib/events/whatsapp'
import { EventShell } from './EventShell'
import { EventTitle } from './EventTitle'
import { OrnamentDivider } from './Ornament'
import { BuyForm } from './BuyForm'

/** Página pública de un evento: portada, datos y formulario de compra (A1). */
export function EventLanding({ event, now = new Date() }: { event: PublicEvent; now?: Date }) {
  const theme = eventTheme(event.theme)
  const open = canBuy(event, now)
  const ended = now.getTime() > event.endsAt.getTime()
  const closedText = ended
    ? 'Este evento ya terminó.'
    : !event.ticketsEnabled
      ? 'Escribinos por WhatsApp para más información.'
      : 'La venta de entradas está cerrada.'

  return (
    <EventShell theme={event.theme}>
      <div className="flex min-h-screen flex-col pb-8">
        <div className="absolute left-4 top-4 z-10">
          <Link href="/eventos" className="ev-kicker rounded-full px-3 py-2 text-[color:var(--ev-fg)] no-underline" style={{ background: 'color-mix(in srgb, var(--ev-bg) 75%, transparent)' }}>← EVENTOS</Link>
        </div>
        {event.imageUrl ? (
          <div className="relative h-[300px] flex-shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.imageUrl} alt={`Portada de ${event.name}`} className="h-full w-full object-cover" style={{ objectPosition: 'center 38%' }} />
            <div className="ev-fade-bottom absolute inset-0" />
          </div>
        ) : (
          <div className="h-[140px] flex-shrink-0" />
        )}

        <div className="ev-card mx-4 -mt-16 px-6 pb-6 pt-[26px]">
          <div className="flex flex-col items-center gap-[6px] text-center">
            <p className="ev-kicker text-[color:var(--ev-accent)]">{theme === 'villains' ? 'SOLICITÁ TU INVITACIÓN' : 'RESERVÁ TU LUGAR'}</p>
            <EventTitle name={event.name} className="text-[30px] leading-[1.05]" />
            <p className="text-[15px] font-semibold tracking-[0.02em]">{eventDateSentence(event.startsAt)}</p>
            <p className="text-[14px] text-[color:var(--ev-muted)]">{event.venue}</p>
          </div>
          <OrnamentDivider className="mb-[14px] mt-4" />
          {open ? (
            <BuyForm priceCents={event.priceCents} slug={event.slug} />
          ) : (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-[18px] font-semibold">{closedText}</p>
              {!ended && (
                <a href={waLink(`Hola, quiero información sobre ${event.name}`, EVENT_STUDIO_WHATSAPP)} target="_blank" rel="noopener noreferrer" className="ev-btn-outline w-full">
                  ESCRIBIR POR WHATSAPP
                </a>
              )}
            </div>
          )}
        </div>

        {open && (
          <p className="mx-7 mt-[18px] text-center text-[15px] leading-[1.4] text-[color:var(--ev-muted-on-bg)]">
            El pago es por transferencia. Tu entrada te llega por WhatsApp apenas confirmemos el pago.
          </p>
        )}
        {(event.summary || event.description) && (
          <section className="mx-6 mt-6 flex flex-col gap-3 text-[17px] leading-[1.5]">
            {event.summary && <p className="font-semibold">{event.summary}</p>}
            {event.description.split(/\n{2,}/).map((para) => para.trim() && <p key={para.slice(0, 40)}>{para}</p>)}
          </section>
        )}
      </div>
    </EventShell>
  )
}
