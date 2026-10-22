import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getOrderView } from '@/lib/events/orders'
import { EVENT_BANK, EVENT_STUDIO_WHATSAPP } from '@/lib/events/config'
import { proofMessage, waLink } from '@/lib/events/whatsapp'
import { formatUsd } from '@/lib/events/emails'
import { eventTheme } from '@/lib/events/format'
import { CopyCodeButton } from './CopyCodeButton'
import { EventShell } from './EventShell'


function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="ev-btn-outline min-h-[48px] border-dashed text-[color:var(--ev-ink)]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z" />
      </svg>
      {label}
    </a>
  )
}

const STEPS = ['Transferís con el código en el concepto.', 'Confirmamos el pago en el banco.']
const ROMAN = ['I', 'II', 'III']

/** Página del pedido (A2): instrucciones de pago y estado. La usan /eventos/pedido y /halloween/pedido. */
export async function OrderPage({ accessToken }: { accessToken: string }) {
  const order = await getOrderView(accessToken)
  if (!order) notFound()
  const villains = eventTheme(order.event.theme) === 'villains'
  const steps = [...STEPS, villains ? 'Tu invitación sellada llega por WhatsApp.' : 'Tu entrada con QR llega por WhatsApp.']

  const proofUrl = waLink(proofMessage(order.code), EVENT_STUDIO_WHATSAPP)
  const bankRows: [string, string][] = [
    ['Monto', formatUsd(order.amountCents)],
    ['Banco', EVENT_BANK.name],
    ['Tipo', EVENT_BANK.accountType],
    ['Cuenta', EVENT_BANK.account],
    ['A nombre de', EVENT_BANK.holder],
  ]

  return (
    <EventShell theme={order.event.theme}>
    <div className="relative flex min-h-screen flex-col gap-[18px] px-4 pb-6 pt-9">
      {villains && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] opacity-85">
          <Image src="/halloween/telon.jpg" alt="" fill sizes="440px" className="object-cover" />
        </div>
      )}
      <p className="ev-kicker relative text-center text-[color:var(--ev-muted-on-bg)]">{order.event.name.toUpperCase()}</p>

      {order.state === 'pending' && (
        <>
          <header className="relative flex flex-col items-center gap-[6px] text-center">
            <p className="ev-kicker text-[color:var(--ev-muted-on-bg)]">PASO 2 DE 3</p>
            <h1 className="ev-playfair m-0 text-[32px] font-normal leading-[1.08]">
              Tu invitación<br /><span className="italic text-[color:var(--ev-accent-on-bg)]">espera su sello.</span>
            </h1>
          </header>
          <section className="ev-card flex flex-col gap-[14px] px-[22px] pb-5 pt-[22px]">
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-[16px] leading-[1.3]">
                Al transferir, agregá este código en el campo <strong>“Concepto”</strong> de tu transferencia:
              </p>
              <p className="ev-playfair text-[44px] leading-[1.1] tracking-[0.06em] text-[color:var(--ev-accent)]">{order.code}</p>
              <p className="text-[14px] italic text-[color:var(--ev-muted)]">Sin este código no podemos identificar tu pago.</p>
              <CopyCodeButton code={order.code} />
            </div>
            <div className="h-px ev-rule" />
            <dl className="flex flex-col gap-2 text-[16px]">
              {bankRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-[color:var(--ev-muted)]">{k}</dt>
                  <dd className="text-right font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <WhatsAppButton href={proofUrl} label="Enviar comprobante por WhatsApp" />
          </section>
          <ol className="relative flex flex-col gap-3 px-2">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className={`ev-cinzel flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] ${i === 0 ? 'bg-[color:var(--ev-accent)] text-[color:var(--ev-on-accent)]' : 'border border-[color:var(--ev-muted-on-bg)]'}`}>
                  {ROMAN[i]}
                </span>
                <span className="text-[16px]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="relative mx-2 mt-auto text-center text-[15px] italic text-[color:var(--ev-muted-on-bg)]">
            {order.quantity === 1 ? 'Tu lugar queda apartado por 24 horas.' : `Tus ${order.quantity} lugares quedan apartados por 24 horas.`}
          </p>
        </>
      )}

      {order.state === 'paid' && (
        <>
          <header className="relative flex flex-col items-center gap-[6px] text-center">
            <p className="ev-kicker text-[color:var(--ev-muted-on-bg)]">PEDIDO {order.code}</p>
            <h1 className="ev-playfair m-0 text-[32px] font-normal leading-[1.08]">
              Tu pago está<br /><span className="italic text-[color:var(--ev-accent-on-bg)]">confirmado.</span>
            </h1>
          </header>
          <section className="ev-card flex flex-col gap-3 px-[22px] py-6">
            <p className="text-[17px]">Estas son tus invitaciones. Abrí cada una para ver su QR:</p>
            {order.tickets.map((t) => (
              <a key={t.label} href={t.url} className="ev-btn">{`INVITACIÓN ${t.label}`}</a>
            ))}
          </section>
        </>
      )}

      {(order.state === 'expired' || order.state === 'cancelled') && (
        <>
          <header className="relative flex flex-col items-center gap-[6px] text-center">
            <p className="ev-kicker text-[color:var(--ev-muted-on-bg)]">PEDIDO {order.code}</p>
            <h1 className="ev-playfair m-0 text-[30px] font-normal leading-[1.1]">
              {order.state === 'expired' ? (
                <>Tu apartado <span className="italic text-[color:var(--ev-accent-on-bg)]">venció.</span></>
              ) : (
                <>Este pedido <span className="italic text-[color:var(--ev-accent-on-bg)]">fue anulado.</span></>
              )}
            </h1>
          </header>
          <section className="ev-card flex flex-col gap-4 px-[22px] py-6">
            <p className="text-[17px] leading-[1.4]">
              {order.state === 'expired'
                ? 'Si ya transferiste, escribinos por WhatsApp y lo revisamos.'
                : 'Escribinos por WhatsApp si tenés dudas.'}
            </p>
            <WhatsAppButton href={waLink(`Hola, tengo una consulta sobre mi pedido ${order.code}`, EVENT_STUDIO_WHATSAPP)} label="Escribir por WhatsApp" />
          </section>
        </>
      )}
    </div>
    </EventShell>
  )
}
