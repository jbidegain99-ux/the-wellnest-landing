/**
 * Correo de agradecimiento después de un evento (por defecto The Villains Ball).
 *
 * Por defecto es DRY-RUN: solo lista a quién se le mandaría. Para enviar:
 *   npx tsx scripts/send-event-thanks.ts --evento villains-ball --send
 *
 * Destinatarios: titulares con correo y check-in, sin repetir correo.
 * Los enlaces apuntan a producción (no a NEXTAUTH_URL, que en local es localhost).
 */
import './loadEnv'

const PUBLIC_URL = 'https://wellneststudio.net'

async function main() {
  const send = process.argv.includes('--send')
  const i = process.argv.indexOf('--evento')
  const slug = i > -1 ? process.argv[i + 1] : 'villains-ball'
  const { prisma } = await import('../src/lib/prisma')
  const { sendEmail } = await import('../src/lib/emailService')
  const { buildThanksEmail } = await import('../src/lib/events/emails')

  const event = await prisma.event.findUnique({ where: { slug }, select: { name: true, startsAt: true, venue: true, thanksMessage: true } })
  if (!event) throw new Error(`No existe el evento "${slug}"`)
  console.log(`Evento: ${event.name}`)

  const tickets = await prisma.eventTicket.findMany({
    where: { checkedInAt: { not: null }, holderEmail: { not: null }, order: { status: 'PAID' }, event: { slug } },
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
      subject: `Gracias por venir a ${event.name}`,
      html: buildThanksEmail({ name: firstName, ticketUrl: `${PUBLIC_URL}/entrada/${r.token}`, event }),
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
