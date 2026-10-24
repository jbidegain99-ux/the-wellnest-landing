import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UNSUBSCRIBE_CONFIRM_PATH, validUnsubscribeLink } from '@/lib/progress/emailOptOut'

export const dynamic = 'force-dynamic'

const INVALID_TEXT = 'Este enlace no es válido.'

function plain(text: string, status: number): NextResponse {
  return new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/**
 * GET /api/email/progress-unsubscribe?u=<userId>&t=<firma>
 * Nunca guarda nada: los escáneres de enlaces (Outlook Safe Links) abren los GET.
 * Los correos ya enviados apuntaban aquí, así que se reenvía a la página de
 * confirmación con los mismos `u` y `t`.
 */
export async function GET(req: NextRequest) {
  const target = new URL(UNSUBSCRIBE_CONFIRM_PATH, req.nextUrl.origin)
  for (const key of ['u', 't']) {
    const value = req.nextUrl.searchParams.get(key)
    if (value) target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target, 303)
}

/**
 * POST /api/email/progress-unsubscribe (formulario: u, t)
 * Botón "Confirmar baja" de /correo/baja/confirmar: guarda la baja sin pedir
 * sesión y redirige a /correo/baja.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('[PROGRESS_UNSUBSCRIBE] NEXTAUTH_SECRET not configured')
    return plain('Error interno', 500)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return plain(INVALID_TEXT, 400)
  }
  const u = form.get('u')
  const t = form.get('t')
  const link = validUnsubscribeLink(typeof u === 'string' ? u : null, typeof t === 'string' ? t : null, secret)
  if (!link) return plain(INVALID_TEXT, 400)

  try {
    const user = await prisma.user.findUnique({ where: { id: link.userId }, select: { id: true } })
    if (!user) return plain(INVALID_TEXT, 400)

    await prisma.progressEmailOptOut.upsert({
      where: { userId: link.userId },
      create: { userId: link.userId },
      update: {},
    })
  } catch (error) {
    console.error('[PROGRESS_UNSUBSCRIBE] Error saving opt-out:', error)
    return plain('Error interno', 500)
  }

  return NextResponse.redirect(new URL('/correo/baja', req.nextUrl.origin), 303)
}
