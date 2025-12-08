import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Try to get existing settings
    const settings = await prisma.notificationSettings.findUnique({
      where: { userId: session.user.id },
    })

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        emailReservations: true,
        emailReminders: true,
        emailPromotions: false,
      })
    }

    return NextResponse.json({
      emailReservations: settings.emailReservations,
      emailReminders: settings.emailReminders,
      emailPromotions: settings.emailPromotions,
    })
  } catch (error) {
    console.error('Error fetching notification settings:', error)
    // Return defaults on error
    return NextResponse.json({
      emailReservations: true,
      emailReminders: true,
      emailPromotions: false,
    })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      emailReservations,
      emailReminders,
      emailPromotions,
    } = body

    // Upsert notification settings
    const settings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: {
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
      },
      create: {
        userId: session.user.id,
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
      },
    })

    return NextResponse.json({
      message: 'Preferencias guardadas correctamente',
      settings: {
        emailReservations: settings.emailReservations,
        emailReminders: settings.emailReminders,
        emailPromotions: settings.emailPromotions,
      },
    })
  } catch (error) {
    console.error('Error updating notification settings:', error)
    return NextResponse.json(
      { error: 'Error al guardar las preferencias' },
      { status: 500 }
    )
  }
}
