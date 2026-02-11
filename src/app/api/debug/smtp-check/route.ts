import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/emailService'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('s') !== 'wn2026') {
    return NextResponse.json({ error: 'no' }, { status: 401 })
  }

  const config = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    passLen: process.env.SMTP_PASS?.length,
    hostHex: Buffer.from(process.env.SMTP_HOST || '').toString('hex'),
  }

  const to = searchParams.get('to') || 'jbidegain@republicode.com'

  const result = await sendEmail({
    to,
    subject: `Wellnest SMTP Check ${new Date().toLocaleTimeString()}`,
    html: '<h2 style="color:#2D5A4A">SMTP OK desde Vercel</h2><p>' + new Date().toISOString() + '</p>',
  })

  return NextResponse.json({ config, result })
}
