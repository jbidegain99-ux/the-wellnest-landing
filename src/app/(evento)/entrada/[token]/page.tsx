import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTicketPage, type TicketPage } from '@/lib/events/tickets'
import { qrSvg } from '@/lib/events/qr'
import { eventDateLine, eventTheme, morningAfterLine } from '@/lib/events/format'
import { EventShell } from '@/components/evento/EventShell'
import { EventSeal } from '@/components/evento/EventSeal'
import { ClaimForm } from '@/components/evento/ClaimForm'
import { PassInvitations } from '@/components/evento/PassInvitations'
import { ActivateButton } from '@/components/evento/ActivateButton'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const page = await getTicketPage(token)
  const name = page?.event.name ?? 'Wellnest'
  const description = page ? `${eventDateLine(page.event.startsAt)} · ${page.event.venue}. Mostrá el QR en la puerta.` : 'Mostrá el QR en la puerta.'
  return {
    title: `Tu entrada · ${name}`,
    description,
    robots: { index: false, follow: false },
    // La imagen la genera opengraph-image.tsx (la entrada con su QR)
    openGraph: { title: `Tu entrada a ${name}`, description, type: 'website', locale: 'es_SV' },
  }
}

function InvitationShell({ page, children }: { page: TicketPage; children: React.ReactNode }) {
  const villains = eventTheme(page.event.theme) === 'villains'
  return (
    <EventShell theme={page.event.theme}>
      <div className="relative flex min-h-screen flex-col items-center gap-4 px-5 pb-6 pt-[30px]">
        {villains && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] -scale-y-100 opacity-90">
            <Image src="/halloween/telon.jpg" alt="" fill sizes="440px" className="object-cover" />
          </div>
        )}
        <p className="ev-kicker relative text-[color:var(--ev-muted-on-bg)]">
          {villains ? 'INVITACIÓN' : 'ENTRADA'} {page.seq} DE {page.quantity}
        </p>
        {children}
      </div>
    </EventShell>
  )
}

export default async function EntradaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const page = await getTicketPage(token)
  if (!page) notFound()
  const { event } = page
  const villains = eventTheme(event.theme) === 'villains'
  const sealClass = 'absolute -top-9 left-1/2 -ml-[39px]'

  if (page.phase === 'cancelled') {
    return (
      <InvitationShell page={page}>
        <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-3 px-6 pb-8 pt-12 text-center">
          <EventSeal theme={event.theme} className={sealClass} />
          <h1 className="ev-playfair text-[28px] leading-[1.15]">Esta entrada <span className="italic text-[color:var(--ev-accent)]">fue anulada.</span></h1>
          <p className="text-[16px] text-[color:var(--ev-muted)]">Si creés que es un error, escribinos por WhatsApp.</p>
        </section>
      </InvitationShell>
    )
  }

  if (page.phase === 'unclaimed') {
    return (
      <InvitationShell page={page}>
        <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-[10px] px-6 pb-6 pt-12 text-center">
          <EventSeal theme={event.theme} className={sealClass} />
          <p className="ev-cinzel text-[10px] font-semibold tracking-[0.3em] text-[color:var(--ev-muted)]">{page.buyerFirstName.toUpperCase()} TE INVITA A</p>
          <p className="ev-cinzel text-[21px] font-semibold tracking-[0.08em]">{event.name.toUpperCase()}</p>
          <p className="text-[16px] font-bold tracking-[0.04em]">{eventDateLine(event.startsAt)}</p>
          <p className="mb-2 text-[17px] italic">Esta {villains ? 'invitación' : 'entrada'} es para vos. Dejanos tus datos para recibir tu QR.</p>
          <ClaimForm token={page.token} />
        </section>
      </InvitationShell>
    )
  }

  if (page.phase === 'after-attended' || page.phase === 'after-missed') {
    const attended = page.phase === 'after-attended'
    const name = page.holderFirstName || page.buyerFirstName
    const hero = villains ? '/halloween/aro-sombra.jpg' : event.imageUrl
    const thanks = event.thanksMessage ?? `Fue un honor tenerte en ${event.name}.`
    return (
      <EventShell theme={event.theme}>
        <div className="relative flex min-h-screen flex-col">
          <div className="relative h-[300px] flex-shrink-0 overflow-hidden">
            {hero && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={hero} alt="" className="h-full w-full object-cover" style={{ objectPosition: 'center 32%' }} />
            )}
            <div className="ev-fade-bottom absolute inset-0" />
            <p className="ev-kicker absolute bottom-[26px] left-6 text-[color:var(--ev-fg)]">{villains ? morningAfterLine(event.startsAt) : event.name.toUpperCase()}</p>
          </div>
          <section className="ev-card mx-4 -mt-[6px] flex flex-col gap-[14px] px-6 pb-6 pt-[30px]">
            <h1 className="ev-playfair text-[30px] font-normal leading-[1.12]">
              {attended ? 'Gracias por venir,' : villains ? 'La función terminó,' : 'El evento terminó,'}<br />
              <span className="italic text-[color:var(--ev-accent)]">{name}.</span>
            </h1>
            {attended && <p className="text-[18px] leading-[1.4]">{thanks}</p>}
            <p className="text-[18px] leading-[1.4]">Tu cuenta ya está creada. Activala para ver los paquetes y reservar tus clases.</p>
            <ActivateButton token={page.token} />
          </section>
          {attended && (
            <p className="mx-7 mb-[26px] mt-auto pt-6 text-center text-[15px] italic text-[color:var(--ev-muted-on-bg)]">
              Esta es la misma {villains ? 'invitación' : 'entrada'} que mostraste en la puerta: después del evento se convierte en esta carta.
            </p>
          )}
        </div>
      </EventShell>
    )
  }

  const svg = await qrSvg(page.url)
  return (
    <InvitationShell page={page}>
      <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-[6px] px-6 pb-[22px] pt-[46px] text-center">
        <EventSeal theme={event.theme} broken className={`${sealClass} drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)]`} />
        <p className="ev-cinzel text-[10px] font-semibold tracking-[0.3em] text-[color:var(--ev-muted)]">THE SOUL HUB TE ESPERA</p>
        <p className="ev-playfair text-[32px] italic leading-[1.1] text-[color:var(--ev-accent)]">{page.holderLabel}</p>
        <p className="ev-cinzel mt-[2px] text-[21px] font-semibold tracking-[0.08em]">{event.name.toUpperCase()}</p>
        <div className="mb-2 mt-3 border border-[color:var(--ev-border)] p-3">
          <div className="ev-qr h-[168px] w-[168px]" role="img" aria-label={`Código QR de la entrada ${page.label}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="text-[16px] font-bold tracking-[0.04em]">{eventDateLine(event.startsAt)}</p>
        <p className="text-[15px] text-[color:var(--ev-muted)]">{event.venue}</p>
        <p className="ev-cinzel mt-[6px] text-[10px] font-semibold tracking-[0.22em] text-[color:var(--ev-muted)]">ADMITE A UNA PERSONA · {page.label}</p>
      </section>
      <div className="relative mt-1 flex w-full flex-col gap-[10px]">
        {page.others.length > 0 && <PassInvitations others={page.others} />}
        <a href={`/api/eventos/${event.slug}/calendario`} className="ev-btn-outline">AGREGAR AL CALENDARIO</a>
      </div>
      <p className="relative m-0 text-center text-[14px] italic text-[color:var(--ev-muted-on-bg)]">
        Mostrá esta {villains ? 'invitación' : 'entrada'} en la puerta. Es personal y solo se usa una vez.
      </p>
    </InvitationShell>
  )
}
