import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const newsletterSchema = z.object({
  email: z.string().email('Email inválido'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validation = newsletterSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email } = validation.data

    // Check if already subscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'Ya estás suscrito al newsletter' },
        { status: 200 }
      )
    }

    await prisma.newsletterSubscriber.create({
      data: { email },
    })

    return NextResponse.json(
      { message: 'Suscripción exitosa' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error subscribing to newsletter:', error)
    return NextResponse.json(
      { error: 'Error al suscribirse' },
      { status: 500 }
    )
  }
}
