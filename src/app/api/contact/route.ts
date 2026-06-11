import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEmail } from '@/lib/emailService'
import { checkRateLimit, requestIp } from '@/lib/rateLimit'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const contactSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto').max(100, 'Nombre muy largo'),
  email: z.string().email('Email inválido').max(254),
  phone: z.string().max(30).optional(),
  subject: z.string().min(3, 'Asunto muy corto').max(200, 'Asunto muy largo'),
  message: z.string().min(10, 'Mensaje muy corto').max(5000, 'Mensaje muy largo'),
})

export async function POST(request: Request) {
  try {
    // 5 mensajes / 10 min por IP (spam del formulario público)
    const rl = checkRateLimit(`contact:${requestIp(request)}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intenta de nuevo en unos minutos.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    const validation = contactSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, phone, subject, message } = validation.data

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
      },
    })

    // Notificar al estudio — sin esto los mensajes solo quedaban en una tabla
    // que nadie lee. El fallo del email no rompe la respuesta (el mensaje ya
    // quedó guardado), pero sí se loguea.
    const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@wellneststudio.net'
    await sendEmail({
      to: recipient,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      html: `
        <h2>Nuevo mensaje desde el formulario de contacto</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${phone ? `<p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>` : ''}
        <p><strong>Asunto:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Mensaje:</strong></p>
        <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
        <hr>
        <p style="color:#6B7280;font-size:12px;">ID del mensaje: ${contactMessage.id}</p>
      `,
    }).catch((err) => {
      console.error('[CONTACT] Notification email failed (message saved):', err)
    })

    return NextResponse.json(
      { message: 'Mensaje enviado exitosamente', id: contactMessage.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error saving contact message:', error)
    return NextResponse.json(
      { error: 'Error al enviar el mensaje' },
      { status: 500 }
    )
  }
}
