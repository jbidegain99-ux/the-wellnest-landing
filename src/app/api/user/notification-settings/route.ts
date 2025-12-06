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
        emailNewsletter: true,
        smsReminders: false,
        phoneNumber: null,
        phoneVerified: false,
      })
    }

    return NextResponse.json({
      emailReservations: settings.emailReservations,
      emailReminders: settings.emailReminders,
      emailPromotions: settings.emailPromotions,
      emailNewsletter: settings.emailNewsletter,
      smsReminders: settings.smsReminders,
      phoneNumber: settings.phoneNumber,
      phoneVerified: settings.phoneVerified,
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
      phoneNumber: null,
      phoneVerified: false,
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
      phoneNumber,
    } = body

    // Get existing settings to check if phone number changed
    const existingSettings = await prisma.notificationSettings.findUnique({
      where: { userId: session.user.id },
    })

    // Determine if phone number changed (needs re-verification)
    const phoneChanged = phoneNumber !== undefined && phoneNumber !== existingSettings?.phoneNumber
    const phoneVerified = phoneChanged ? false : existingSettings?.phoneVerified ?? false

    // Upsert notification settings
    const settings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: {
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
        emailNewsletter: emailNewsletter ?? true,
        smsReminders: smsReminders ?? false,
        ...(phoneNumber !== undefined && {
          phoneNumber: phoneNumber || null,
          phoneVerified,
        }),
      },
      create: {
        userId: session.user.id,
        emailReservations: emailReservations ?? true,
        emailReminders: emailReminders ?? true,
        emailPromotions: emailPromotions ?? false,
        emailNewsletter: emailNewsletter ?? true,
        smsReminders: smsReminders ?? false,
        phoneNumber: phoneNumber || null,
        phoneVerified: false,
      },
    })

    // If SMS reminders enabled but no verified phone, warn user
    let warning = null
    if (settings.smsReminders && !settings.phoneVerified) {
      if (!settings.phoneNumber) {
        warning = 'Para recibir recordatorios por SMS, debes agregar tu numero de telefono.'
      } else {
        warning = 'Tu numero de telefono necesita ser verificado para recibir SMS.'
      }
    }

    return NextResponse.json({
      message: 'Preferencias guardadas correctamente',
      warning,
      settings: {
        emailReservations: settings.emailReservations,
        emailReminders: settings.emailReminders,
        emailPromotions: settings.emailPromotions,
        emailNewsletter: settings.emailNewsletter,
        smsReminders: settings.smsReminders,
        phoneNumber: settings.phoneNumber,
        phoneVerified: settings.phoneVerified,
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
