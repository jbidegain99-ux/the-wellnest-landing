import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildPasswordResetEmail } from '@/lib/emailService'

/**
 * POST /api/auth/forgot-password
 * Genera un token seguro y envía un email con el enlace de reseteo.
 * Siempre responde con éxito para no revelar si el email existe.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'El email es requerido' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Buscar el usuario
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    })

    if (user) {
      // Invalidar tokens previos no usados
      await prisma.passwordResetToken.updateMany({
        where: {
          email: normalizedEmail,
          used: false,
          expiresAt: { gt: new Date() },
        },
        data: { used: true },
      })

      // Generar token seguro
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1) // 1 hora de validez

      await prisma.passwordResetToken.create({
        data: {
          email: normalizedEmail,
          token,
          expiresAt,
        },
      })

      // Construir URL de reseteo
      const baseUrl = process.env.NEXTAUTH_URL || 'https://wellneststudio.net'
      const resetUrl = `${baseUrl}/reset-password?token=${token}`
      const html = buildPasswordResetEmail(user.name, resetUrl)

      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: 'Restablecer contraseña - Wellnest',
        html,
      })

      if (emailResult.success) {
        console.log(`[FORGOT PASSWORD] Email enviado a: ${normalizedEmail} (${emailResult.messageId})`)
      } else {
        console.error(`[FORGOT PASSWORD] Error enviando email a ${normalizedEmail}: ${emailResult.error}`)
      }
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
