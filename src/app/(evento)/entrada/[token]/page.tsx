import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTicketPage, type TicketPage } from '@/lib/events/tickets'
import { qrSvg } from '@/lib/events/qr'
import { EVENT_DATE_LINE, EVENT_VENUE_LINE, VILLAINS_BALL_SLUG } from '@/lib/events/config'
import { WaxSeal } from '@/components/evento/WaxSeal'
import { ClaimForm } from '@/components/evento/ClaimForm'
import { PassInvitations } from '@/components/evento/PassInvitations'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu invitación · The Villains Ball', robots: { index: false, follow: false } }

function InvitationShell({ page, children }: { page: TicketPage; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center gap-4 px-5 pb-6 pt-[30px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] -scale-y-100 opacity-90">
        <Image src="/halloween/telon.jpg" alt="" fill sizes="440px" className="object-cover" />
      </div>
      <p className="ev-kicker relative text-[#CDBFA8]">INVITACIÓN {page.seq} DE {page.quantity}</p>
      {children}
    </div>
  )
}

export default async function EntradaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const page = await getTicketPage(token)
  if (!page) notFound()

  if (page.phase === 'cancelled') {
    return (
      <InvitationShell page={page}>
        <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-3 px-6 pb-8 pt-12 text-center">
          <WaxSeal className="absolute -top-9 left-1/2 -ml-[39px]" />
          <h1 className="ev-playfair text-[28px] leading-[1.15]">Esta invitación <span className="italic text-[#8E1A24]">fue anulada.</span></h1>
          <p className="text-[16px] text-[#4A3B32]">Si creés que es un error, escribinos por WhatsApp.</p>
        </section>
      </InvitationShell>
    )
  }

  if (page.phase === 'unclaimed') {
    return (
      <InvitationShell page={page}>
        <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-[10px] px-6 pb-6 pt-12 text-center">
          <WaxSeal className="absolute -top-9 left-1/2 -ml-[39px]" />
          <p className="ev-cinzel text-[10px] font-semibold tracking-[0.3em] text-[#4A3B32]">{page.buyerFirstName.toUpperCase()} TE INVITA A</p>
          <p className="ev-cinzel text-[21px] font-semibold tracking-[0.08em]">THE VILLAINS BALL</p>
          <p className="text-[16px] font-bold tracking-[0.04em]">{EVENT_DATE_LINE}</p>
          <p className="mb-2 text-[17px] italic">Esta invitación es para vos. Dejanos tus datos para recibir tu QR.</p>
          <ClaimForm token={page.token} />
        </section>
      </InvitationShell>
    )
  }

  if (page.phase === 'after-attended' || page.phase === 'after-missed') {
    // Carta de después del show: Task 11
    return (
      <InvitationShell page={page}>
        <section className="ev-card mt-[18px] w-full px-6 py-10 text-center">
          <p className="ev-playfair text-[26px]">The Villains Ball ya terminó.</p>
        </section>
      </InvitationShell>
    )
  }

  const svg = await qrSvg(page.url)
  return (
    <InvitationShell page={page}>
      <section className="ev-card mt-[18px] flex w-full flex-col items-center gap-[6px] px-6 pb-[22px] pt-[46px] text-center shadow-[0_22px_50px_rgba(0,0,0,0.6)]">
        <WaxSeal broken className="absolute -top-9 left-1/2 -ml-[39px] drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)]" />
        <p className="ev-cinzel text-[10px] font-semibold tracking-[0.3em] text-[#4A3B32]">THE SOUL HUB TE ESPERA</p>
        <p className="ev-playfair text-[32px] italic leading-[1.1] text-[#8E1A24]">{page.holderLabel}</p>
        <p className="ev-cinzel mt-[2px] text-[21px] font-semibold tracking-[0.08em]">THE VILLAINS BALL</p>
        <div className="mb-2 mt-3 border border-[#8C7A6B] p-3">
          <div className="ev-qr h-[168px] w-[168px]" role="img" aria-label={`Código QR de la entrada ${page.label}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="text-[16px] font-bold tracking-[0.04em]">{EVENT_DATE_LINE}</p>
        <p className="text-[15px] text-[#4A3B32]">{EVENT_VENUE_LINE}</p>
        <p className="ev-cinzel mt-[6px] text-[10px] font-semibold tracking-[0.22em] text-[#4A3B32]">ADMITE A UNA PERSONA · {page.label}</p>
      </section>
      <div className="relative mt-1 flex w-full flex-col gap-[10px]">
        {page.others.length > 0 && <PassInvitations others={page.others} />}
        <a href={`/api/eventos/${VILLAINS_BALL_SLUG}/calendario`} className="ev-btn-outline">AGREGAR AL CALENDARIO</a>
      </div>
      <p className="relative m-0 text-center text-[14px] italic text-[#CDBFA8]">Mostrá esta invitación en la puerta. Es personal y solo se usa una vez.</p>
    </InvitationShell>
  )
}
