import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('s') !== 'wn2026') {
    return NextResponse.json({ error: 'no' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = searchParams.get('to') || 'jbidegain@republicode.com'

  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set', hasKey: false })
  }

  const resend = new Resend(apiKey)

  // Test 1: Send from custom domain
  const test1 = await resend.emails.send({
    from: 'Wellnest <no-reply@wellneststudio.net>',
    to,
    subject: `Resend Test Custom Domain - ${new Date().toLocaleTimeString()}`,
    html: '<h2>Test from no-reply@wellneststudio.net</h2>',
  })

  // Test 2: Send from Resend default domain (always works)
  const test2 = await resend.emails.send({
    from: 'Wellnest <onboarding@resend.dev>',
    to,
    subject: `Resend Test Default Domain - ${new Date().toLocaleTimeString()}`,
    html: '<h2>Test from onboarding@resend.dev</h2>',
  })

  return NextResponse.json({
    apiKeyPrefix: apiKey.slice(0, 10) + '...',
    customDomain: { data: test1.data, error: test1.error },
    defaultDomain: { data: test2.data, error: test2.error },
  })
}
