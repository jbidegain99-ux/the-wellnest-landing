import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'Asunto muy corto'),
  message: z.string().min(10, 'Mensaje muy corto'),
})

export async function POST(request: Request) {
  try {
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

    // Here you would typically send an email notification
    // await sendEmail({ to: 'admin@thewellnest.sv', subject, ... })

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
