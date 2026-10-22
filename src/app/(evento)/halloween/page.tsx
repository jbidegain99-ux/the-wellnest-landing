import type { Metadata } from 'next'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { VILLAINS_BALL_SLUG } from '@/lib/events/config'
import { OrnamentDivider } from '@/components/evento/Ornament'
import { BuyForm } from '@/components/evento/BuyForm'

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

export default async function HalloweenPage() {
  const event = await prisma.event.findUnique({ where: { slug: VILLAINS_BALL_SLUG } })
  const salesOpen = !!event && event.salesOpen && Date.now() < event.startsAt.getTime()

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <div className="relative h-[300px] flex-shrink-0 overflow-hidden">
        <Image
          src="/halloween/invitacion.jpg"
          alt="Invitación de The Villains Ball sobre una bandeja de plata con sello de lacre"
          fill
          priority
          sizes="440px"
          className="object-cover"
          style={{ objectPosition: 'center 38%' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,9,8,0)_55%,#0D0908_100%)]" />
      </div>

      <div className="ev-card mx-4 -mt-16 px-6 pb-6 pt-[26px]">
        <div className="flex flex-col items-center gap-[6px] text-center">
          <p className="ev-kicker text-[#8E1A24]">SOLICITÁ TU INVITACIÓN</p>
          <h1 className="ev-playfair m-0 text-[30px] font-normal leading-[1.05]">
            The <span className="italic text-[#8E1A24]">Villains</span> Ball
          </h1>
          <p className="text-[15px] font-semibold tracking-[0.02em]">Viernes 30 de octubre · 6:30 p. m.</p>
          <p className="text-[14px] text-[#4A3B32]">Plaza Presidente, nivel 3 · San Salvador</p>
        </div>
        <OrnamentDivider className="mb-[14px] mt-4" />
        {salesOpen && event ? (
          <BuyForm priceCents={event.priceCents} slug={event.slug} />
        ) : (
          <p className="py-6 text-center text-[18px] font-semibold">La venta de entradas está cerrada</p>
        )}
      </div>

      <p className="mx-7 mt-[18px] text-center text-[15px] leading-[1.4] text-[#CDBFA8]">
        El pago es por transferencia. Tu invitación te llega por WhatsApp apenas confirmemos el pago.
      </p>
    </div>
  )
}
