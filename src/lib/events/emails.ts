import { EVENT_BANK } from './config'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const C = { ink: '#0D0908', cream: '#EFE6D6', crimson: '#8E1A24', text: '#1A0F0D', muted: '#4A3B32' }

/** Marco común: fondo oscuro, tarjeta crema con filete carmesí. `body` ya viene escapado. */
function layout(title: string, body: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.cream};border:1px solid ${C.crimson};">
<tr><td style="padding:32px 28px;font-family:Georgia,'Times New Roman',serif;color:${C.text};">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:4px;color:${C.crimson};text-align:center;">THE VILLAINS BALL</p>
<h1 style="margin:0 0 20px;font-size:26px;font-weight:normal;text-align:center;">${title}</h1>
${body}
<p style="margin:28px 0 0;font-size:12px;color:${C.muted};text-align:center;">Viernes 30 de octubre · 6:30 p. m. · Plaza Presidente, nivel 3 · San Salvador</p>
</td></tr></table>
</td></tr></table></body></html>`
}

function button(url: string, label: string): string {
  return `<p style="text-align:center;margin:20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${C.crimson};color:${C.cream};text-decoration:none;padding:14px 22px;font-size:13px;letter-spacing:2px;">${label}</a></p>`
}

export function buildPaymentInstructionsEmail(p: {
  buyerName: string; code: string; amountCents: number; quantity: number; orderUrl: string
}): string {
  const rows: [string, string][] = [
    ['Monto', formatUsd(p.amountCents)],
    ['Banco', EVENT_BANK.name],
    ['Tipo', EVENT_BANK.accountType],
    ['Cuenta', EVENT_BANK.account],
    ['A nombre de', EVENT_BANK.holder],
  ]
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:4px 0;color:${C.muted};font-size:15px;">${k}</td><td style="padding:4px 0;font-size:15px;font-weight:bold;text-align:right;">${escapeHtml(v)}</td></tr>`)
    .join('')
  const lugares = p.quantity === 1 ? 'Tu lugar queda apartado' : `Tus ${p.quantity} lugares quedan apartados`
  return layout(
    'Tu invitación espera su sello',
    `<p style="font-size:16px;line-height:1.5;">Hola ${escapeHtml(p.buyerName)}:</p>
<p style="font-size:16px;line-height:1.5;">Al transferir, agregá este código en el campo <strong>“Concepto”</strong> de tu transferencia:</p>
<p style="text-align:center;font-size:36px;letter-spacing:4px;color:${C.crimson};margin:12px 0 4px;">${escapeHtml(p.code)}</p>
<p style="text-align:center;font-size:14px;font-style:italic;color:${C.muted};margin:0 0 18px;">Sin este código no podemos identificar tu pago.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${table}</table>
<p style="font-size:15px;line-height:1.5;margin-top:18px;">Cuando confirmemos el pago en el banco, tu invitación con QR te llega por WhatsApp. ${lugares} por 24 horas.</p>
${button(p.orderUrl, 'VER MI PEDIDO')}`
  )
}

export function buildTicketsEmail(p: { buyerName: string; tickets: { label: string; url: string }[] }): string {
  const first = p.tickets[0]
  const others = p.tickets.slice(1)
  const otherList = others.length
    ? `<p style="font-size:15px;line-height:1.5;margin-top:22px;">Tus otras invitaciones, para pasarlas a tus acompañantes:</p>
<ul style="padding-left:18px;font-size:15px;line-height:1.7;">${others
        .map((t) => `<li><a href="${escapeHtml(t.url)}" style="color:${C.crimson};">${escapeHtml(t.label)}</a></li>`)
        .join('')}</ul>
<p style="font-size:14px;color:${C.muted};">Cada acompañante abre su enlace y deja sus datos para recibir su QR.</p>`
    : ''
  return layout(
    'Tu invitación está sellada',
    `<p style="font-size:16px;line-height:1.5;">Hola ${escapeHtml(p.buyerName)}: tu pago está confirmado.</p>
<p style="font-size:16px;line-height:1.5;">Esta es tu invitación (${escapeHtml(first?.label ?? '')}). Mostrá el QR en la puerta: es personal y solo se usa una vez.</p>
${first ? button(first.url, 'ABRIR MI INVITACIÓN') : ''}
${otherList}`
  )
}

export function buildThanksEmail(p: { name: string; ticketUrl: string }): string {
  return layout(
    `Gracias por venir, <em style="color:${C.crimson};">${escapeHtml(p.name)}</em>.`,
    `<p style="font-size:16px;line-height:1.5;">Fue un honor tenerte en The Villains Ball. Lo que viste en escena se entrena en Wellnest: pole, aro y tela.</p>
<p style="font-size:16px;line-height:1.5;">Tu cuenta ya está creada. Activala para ver los paquetes y reservar tus clases.</p>
${button(p.ticketUrl, 'ACTIVAR MI CUENTA')}
<p style="text-align:center;font-size:14px;color:${C.muted};">Solo elegís una contraseña.</p>`
  )
}
