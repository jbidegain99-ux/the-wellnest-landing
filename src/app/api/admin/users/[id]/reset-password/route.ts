import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendEmail, buildAdminPasswordResetEmail } from '@/lib/emailService'

// Characters excluding ambiguous ones (0/O, 1/l/I)
const CHARS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CHARS_LOWER = 'abcdefghjkmnpqrstuvwxyz'
const CHARS_DIGITS = '23456789'

function generateTemporaryPassword(): string {
  const allChars = CHARS_UPPER + CHARS_LOWER + CHARS_DIGITS

  // Ensure at least one of each type
  let password = ''
  password += CHARS_UPPER[Math.floor(Math.random() * CHARS_UPPER.length)]
  password += CHARS_LOWER[Math.floor(Math.random() * CHARS_LOWER.length)]
  password += CHARS_DIGITS[Math.floor(Math.random() * CHARS_DIGITS.length)]

  // Fill remaining characters
  for (let i = 3; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  const shuffled = password.split('').sort(() => Math.random() - 0.5).join('')

  return `WnSt-${shuffled}`
}

// POST - reset a user's password and send temporary password via email
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const temporaryPassword = generateTemporaryPassword()
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    const loginUrl = `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/login`
    const emailHtml = buildAdminPasswordResetEmail(user.name || '', user.email, temporaryPassword, loginUrl)

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Tu nueva contraseña temporal — Wellnest Studio',
      html: emailHtml,
    })

    if (!emailResult.success) {
      console.error(`[RESET-PASSWORD] Email failed for user ${userId}:`, emailResult.error)
      return NextResponse.json(
        { error: 'Contraseña actualizada pero el email no pudo ser enviado. Contacta al usuario directamente.' },
        { status: 500 }
      )
    }

    console.log(`[RESET-PASSWORD] Admin ${session.user.email} reset password for user ${user.email}`)

    return NextResponse.json({
      success: true,
      message: `Contraseña temporal enviada a ${user.email}`,
    })
  } catch (error) {
    console.error('[RESET-PASSWORD] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
