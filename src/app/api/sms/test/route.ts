/**
 * Test SMS API
 *
 * Allows manual sending of a test SMS for verification.
 * Only available in development or with admin authentication.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendSms } from '@/lib/sms'

export async function POST(request: Request) {
  console.log('[SMS TEST] Test SMS request received')

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Only allow admin users in production
    if (process.env.NODE_ENV !== 'development' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { phoneNumber, message } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Numero de telefono requerido' },
        { status: 400 }
      )
    }

    const testMessage = message || 'The Wellnest: Este es un mensaje de prueba del sistema de SMS.'

    console.log('[SMS TEST] Sending test SMS to:', phoneNumber)

    const result = await sendSms({
      to: phoneNumber,
      message: testMessage,
      userId: session.user.id,
      type: 'PROMOTIONAL',
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'SMS de prueba enviado correctamente',
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[SMS TEST] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Error al enviar SMS' },
      { status: 500 }
    )
  }
}
