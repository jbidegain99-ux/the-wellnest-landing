import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/emailService'
import { classSummaryDbFrom, runClassSummaryJob } from '@/lib/progress/classSummaryJob'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/class-summary — resumen por correo después de cada clase.
 * Corre dos veces al día (vercel.json): 13:15 y 21:45 SV. El plan Hobby solo
 * permite crons diarios, por eso son dos entradas con la misma ruta.
 * Toma las clases asistidas que terminaron en las últimas 24 horas.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON_CLASS_SUMMARY] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const expectedHeader = Buffer.from(`Bearer ${expected}`)
  const received = Buffer.from(auth)
  if (received.length !== expectedHeader.length || !timingSafeEqual(received, expectedHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // NEXTAUTH_URL llegó a tener un salto de línea en producción: se limpia.
  const baseUrl = (process.env.NEXTAUTH_URL ?? '').trim().replace(/\/+$/, '')
  const secret = process.env.NEXTAUTH_SECRET
  if (!baseUrl || !secret) {
    console.error('[CRON_CLASS_SUMMARY] NEXTAUTH_URL or NEXTAUTH_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }

  try {
    const result = await runClassSummaryJob({ db: classSummaryDbFrom(prisma), send: sendEmail, now: new Date(), baseUrl, secret })
    console.log('[CRON_CLASS_SUMMARY] Done:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[CRON_CLASS_SUMMARY] Failed:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
