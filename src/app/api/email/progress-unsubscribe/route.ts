import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/progress/emailOptOut'

export const dynamic = 'force-dynamic'

const INVALID_TEXT = 'Este enlace no es válido.'

function plain(text: string, status: number): NextResponse {
  return new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/**
 * GET /api/email/progress-unsubscribe?u=<userId>&t=<firma>
 * Enlace del pie del resumen de clase: guarda la baja sin pedir sesión y
 * redirige a la página de confirmación.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('[PROGRESS_UNSUBSCRIBE] NEXTAUTH_SECRET not configured')
    return plain('Error interno', 500)
  }

  const userId = req.nextUrl.searchParams.get('u') ?? ''
  const token = req.nextUrl.searchParams.get('t') ?? ''
  if (!userId || !token || !verifyUnsubscribeToken(userId, token, secret)) {
    return plain(INVALID_TEXT, 400)
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return plain(INVALID_TEXT, 400)

    await prisma.progressEmailOptOut.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  } catch (error) {
    console.error('[PROGRESS_UNSUBSCRIBE] Error saving opt-out:', error)
    return plain('Error interno', 500)
  }

  return NextResponse.redirect(new URL('/correo/baja', req.nextUrl.origin), 302)
}
