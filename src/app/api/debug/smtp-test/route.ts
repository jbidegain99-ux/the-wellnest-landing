import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/emailService'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/debug/smtp-test
 * Temporary endpoint to diagnose SMTP on Vercel.
 * TODO: Remove after confirming emails work.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Simple protection
  if (secret !== 'wellnest-smtp-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST || 'NOT SET',
    port: process.env.SMTP_PORT || 'NOT SET',
    user: process.env.SMTP_USER || 'NOT SET',
    passConfigured: !!process.env.SMTP_PASS,
    passLength: process.env.SMTP_PASS?.length || 0,
  }

  console.log('[SMTP-TEST] Config:', JSON.stringify(smtpConfig))

  const sendTo = searchParams.get('to') || 'jbidegain@republicode.com'

  try {
    const result = await sendEmail({
      to: sendTo,
      subject: `SMTP Test desde Vercel - ${new Date().toISOString()}`,
      html: `
        <div style="background: #2D5A4A; color: white; padding: 30px; text-align: center; border-radius: 12px;">
          <h2 style="margin: 0 0 10px;">SMTP Test OK</h2>
          <p style="margin: 0 0 5px;">Enviado desde Vercel produccion</p>
          <p style="margin: 0; font-size: 12px; opacity: 0.8;">${new Date().toISOString()}</p>
        </div>
      `,
    })

    console.log('[SMTP-TEST] Result:', JSON.stringify(result))

    return NextResponse.json({
      smtpConfig,
      sendTo,
      result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[SMTP-TEST] Error:', error)

    return NextResponse.json({
      smtpConfig,
      sendTo,
      error,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
