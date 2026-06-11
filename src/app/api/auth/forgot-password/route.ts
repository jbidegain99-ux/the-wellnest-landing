import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildPasswordResetEmail } from '@/lib/emailService'
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
      // Generar token seguro (usando el email REAL de la cuenta — para
      // cuentas legacy con mayúsculas, normalizedEmail no matchearía después)
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1) // 1 hora de validez

      await prisma.passwordResetToken.create({
        data: {
          email: user.email,
          token,
          expiresAt,
        },
      })

      // Construir URL de reseteo
      const baseUrl = process.env.NEXTAUTH_URL || 'https://wellneststudio.net'
      const resetUrl = `${baseUrl}/reset-password?token=${token}`
      const html = buildPasswordResetEmail(user.name, resetUrl)

      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Restablecer contraseña - Wellnest',
        html,
      })

      if (!emailResult.success) {
        // Antes se respondía éxito con el email sin enviar (y los tokens
        // previos ya invalidados): el usuario quedaba sin ninguna vía de reset
        console.error(`[FORGOT PASSWORD] Error enviando email a ${user.email}: ${emailResult.error}`)
        await prisma.passwordResetToken.deleteMany({ where: { token } }).catch(() => {})
        return NextResponse.json(
          { error: 'No pudimos enviar el correo en este momento. Intenta de nuevo en unos minutos.' },
          { status: 500 }
        )
      }

      console.log(`[FORGOT PASSWORD] Email enviado a: ${user.email} (${emailResult.messageId})`)

      // Invalidar tokens previos SOLO tras envío exitoso (excepto el nuevo)
      await prisma.passwordResetToken.updateMany({
        where: {
          email: user.email,
          used: false,
          token: { not: token },
          expiresAt: { gt: new Date() },
        },
        data: { used: true },
      })
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
