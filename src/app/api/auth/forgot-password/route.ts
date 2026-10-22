import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordSetupEmail } from '@/lib/passwordSetup'
import { checkRateLimit, requestIp } from '@/lib/rateLimit'

/**
 * POST /api/auth/forgot-password
 * Genera un token seguro y envía un email con el enlace de reseteo.
 * Siempre responde con éxito para no revelar si el email existe.
 */
export async function POST(request: Request) {
  try {
    // 5 solicitudes / 15 min por IP (spam de emails de reset)
    const rl = checkRateLimit(`forgot:${requestIp(request)}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
        { status: 429 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'El email es requerido' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Buscar el usuario: 1) match exacto con lo tecleado (protege cuentas
    // legacy duplicadas solo por mayúsculas), 2) normalizado, 3) fallback
    // insensible para cuentas legacy con mayúsculas y sin duplicado
    const user =
      (await prisma.user.findUnique({
        where: { email: email.trim() },
        select: { id: true, name: true, email: true },
      })) ??
      (await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, name: true, email: true },
      })) ??
      (await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true, name: true, email: true },
      }))

    if (user) {
      // Token con hash en BD, envío y limpieza: ver sendPasswordSetupEmail.
      // Se usa el email REAL de la cuenta (legacy con mayúsculas).
      const result = await sendPasswordSetupEmail({ email: user.email, name: user.name })
      if (!result.success) {
        return NextResponse.json(
          { error: 'No pudimos enviar el correo en este momento. Intenta de nuevo en unos minutos.' },
          { status: 500 }
        )
      }
      console.log(`[FORGOT PASSWORD] Email enviado a: ${user.email}`)
    } else {
      console.log(`[FORGOT PASSWORD] Email no encontrado: ${normalizedEmail}`)
    }

    // Siempre retornamos éxito por seguridad
    return NextResponse.json({
      message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.',
      success: true,
    })
  } catch (error) {
    console.error('Error in forgot password:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
