import { ImageResponse } from 'next/og'
import { getTicketPage } from '@/lib/events/tickets'
import { qrPngDataUrl } from '@/lib/events/qr'
import { ticketPreview } from '@/lib/events/preview'
import { EVENT_DATE_LINE, EVENT_VENUE_LINE } from '@/lib/events/config'

// Vista previa de WhatsApp de cada entrada: la invitación con su QR.
export const runtime = 'nodejs'
export const alt = 'Tu invitación a The Villains Ball'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const C = { ink: '#0D0908', cream: '#EFE6D6', crimson: '#8E1A24', text: '#1A0F0D', muted: '#4A3B32' }

export default async function Image({ params }: { params: { token: string } }) {
  const page = await getTicketPage(params.token)
  const preview = page
    ? ticketPreview(page)
    : { showQr: false, kicker: 'THE VILLAINS BALL', name: 'Invitación', footer: 'wellneststudio.net' }
  const qr = page && preview.showQr ? await qrPngDataUrl(page.url) : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.ink, padding: 36 }}>
        <div style={{ flex: 1, display: 'flex', background: C.cream, padding: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `2px solid ${C.crimson}`, padding: '28px 44px', gap: 48 }}>
            {qr ? (
              <div style={{ display: 'flex', padding: 14, border: '2px solid #8C7A6B' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} width={420} height={420} alt="" />
              </div>
            ) : (
              <div style={{ width: 300, height: 300, borderRadius: 150, background: '#7A141D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream }}>
                <svg width="150" height="150" viewBox="0 0 24 24">
                  <path fill="#EFE6D6" d="M12 2c-1.5 2-2 4-1 6.5-.8-.9-2.2-1.3-3.5-.8-1.8.7-2.3 3-.8 4.3 1 .9 2.6.8 3.3-.2-.3 1.1-1.3 1.7-2.5 1.7h9c-1.2 0-2.2-.6-2.5-1.7.7 1 2.3 1.1 3.3.2 1.5-1.3 1-3.6-.8-4.3-1.3-.5-2.7-.1-3.5.8 1-2.5.5-4.5-1-6.5zM8 15.6h8v1.2H8zM11.2 16.8h1.6V22h-1.6z" />
                </svg>
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: C.text }}>
              <div style={{ fontSize: 24, letterSpacing: 6, color: C.muted }}>{preview.kicker}</div>
              <div style={{ fontSize: 60, color: C.crimson, fontStyle: 'italic', marginTop: 10, lineHeight: 1.1 }}>{preview.name}</div>
              <div style={{ fontSize: 50, letterSpacing: 3, marginTop: 14 }}>THE VILLAINS BALL</div>
              <div style={{ fontSize: 28, marginTop: 26, fontWeight: 700 }}>{EVENT_DATE_LINE}</div>
              <div style={{ fontSize: 26, color: C.muted, marginTop: 6 }}>{EVENT_VENUE_LINE}</div>
              <div style={{ fontSize: 20, letterSpacing: 3, color: C.muted, marginTop: 26 }}>{preview.footer}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
