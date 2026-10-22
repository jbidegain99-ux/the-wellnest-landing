/**
 * Correo de agradecimiento de The Villains Ball (31-oct).
 *
 * Por defecto es DRY-RUN: solo lista a quién se le mandaría. Para enviar:
 *   npx tsx scripts/send-villains-ball-thanks.ts --send
 *
 * Destinatarios: titulares con correo y check-in, sin repetir correo.
 * Los enlaces apuntan a producción (no a NEXTAUTH_URL, que en local es localhost).
 */
import './loadEnv'

const PUBLIC_URL = 'https://wellneststudio.net'

async function main() {
  const send = process.argv.includes('--send')
  const { prisma } = await import('../src/lib/prisma')
  const { sendEmail } = await import('../src/lib/emailService')
  const { buildThanksEmail } = await import('../src/lib/events/emails')

  const tickets = await prisma.eventTicket.findMany({
    where: { checkedInAt: { not: null }, holderEmail: { not: null }, order: { status: 'PAID' }, event: { slug: 'villains-ball' } },
    orderBy: { checkedInAt: 'asc' },
    select: { token: true, holderEmail: true, holderName: true },
  })

  const seen = new Set<string>()
  const recipients = tickets.filter((t) => {
    const email = (t.holderEmail ?? '').toLowerCase()
    if (!email || seen.has(email)) return false
    seen.add(email)
    return true
  })

  console.log(`${recipients.length} destinatarios (${tickets.length} entradas con check-in y correo)`)
  if (!send) {
    recipients.forEach((r) => console.log(`  - ${r.holderName ?? '(sin nombre)'} <${r.holderEmail}>`))
    console.log('\nDRY-RUN: no se envió nada. Usá --send para enviar.')
    await prisma.$disconnect()
    return
  }

  let ok = 0
  const failed: string[] = []
  for (const r of recipients) {
    const firstName = (r.holderName ?? '').trim().split(/\s+/)[0] || 'de nuevo'
    const res = await sendEmail({
      to: r.holderEmail as string,
      subject: 'Gracias por venir a The Villains Ball',
      html: buildThanksEmail({ name: firstName, ticketUrl: `${PUBLIC_URL}/entrada/${r.token}` }),
    })
    if (res.success) ok++
    else failed.push(`${r.holderEmail}: ${res.error}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  console.log(`Enviados: ${ok}. Fallidos: ${failed.length}`)
  failed.forEach((f) => console.log(`  ✗ ${f}`))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
