import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default settings values
const DEFAULT_SETTINGS: Record<string, string> = {
  siteName: 'Wellnest',
  siteDescription: 'Tu santuario de bienestar integral en El Salvador.',
  phone: '+503 1234 5678',
  email: 'hola@thewellnest.sv',
  address: 'Presidente Plaza, Colonia San Benito, San Salvador, El Salvador',
  stripePublicKey: 'pk_test_...',
  stripeSecretKey: 'sk_test_...',
  cancellationHours: '4',
  defaultCapacity: '15',
  cancellationPolicy: 'Puedes cancelar tu reserva hasta 4 horas antes del inicio de la clase sin penalización. Las cancelaciones tardías o no asistencias resultarán en la pérdida de la clase de tu paquete.',
}

// GET - Retrieve all settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get all settings from DB
    const settings = await prisma.siteSettings.findMany()

    // Merge with defaults
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS }
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

// POST - Update settings
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Configuración inválida' },
        { status: 400 }
      )
    }

    // Upsert each setting
    const updatePromises = Object.entries(settings).map(([key, value]) =>
      prisma.siteSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )

    await Promise.all(updatePromises)

    console.log('[SETTINGS API] Settings updated:', Object.keys(settings))

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada exitosamente',
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}
