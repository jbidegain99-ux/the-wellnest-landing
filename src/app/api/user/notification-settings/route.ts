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
    let settings = await prisma.notificationSettings.findUnique({
      where: { userId: session.user.id },
    })

    // If no settings exist, return defaults
    if (!settings) {
      settings = {
        id: '',
        userId: session.user.id,
        emailReservations: true,
        emailReminders: true,
        emailPromotions: false,
        emailNewsletter: true,
        smsReminders: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    return NextResponse.json({
      emailReservations: settings.emailReservations,
      emailReminders: settings.emailReminders,
      emailPromotions: settings.emailPromotions,
      emailNewsletter: settings.emailNewsletter,
      smsReminders: settings.smsReminders,
    })
  } catch (error) {
    console.error('Error fetching notification settings:', error)
    // Return defaults on error
    return NextResponse.json({
      emailReservations: true,
      emailReminders: true,
      emailPromotions: false,
      emailNewsletter: true,
      smsReminders: false,
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
      emailNewsletter,
      smsReminders,
    } = body

    // Upsert notification settings
    const settings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: {
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
        emailNewsletter: emailNewsletter ?? true,
        smsReminders: smsReminders ?? false,
      },
      create: {
        userId: session.user.id,
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
        emailNewsletter: emailNewsletter ?? true,
        smsReminders: smsReminders ?? false,
      },
    })

    return NextResponse.json({
      message: 'Preferencias guardadas correctamente',
      settings: {
        emailReservations: settings.emailReservations,
        emailReminders: settings.emailReminders,
        emailPromotions: settings.emailPromotions,
        emailNewsletter: settings.emailNewsletter,
        smsReminders: settings.smsReminders,
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
