import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default settings values
// NOTA: los campos de Stripe se eliminaron — el gateway es PayWay y un
// secreto jamás debe vivir en SiteSettings en texto plano.
const DEFAULT_SETTINGS: Record<string, string> = {
  siteName: 'Wellnest',
  siteDescription: 'Tu santuario de bienestar integral en El Salvador.',
  phone: '+503 1234 5678',
  email: 'hola@thewellnest.sv',
  address: 'Presidente Plaza, Colonia San Benito, San Salvador, El Salvador',
  cancellationHours: '4',
  defaultCapacity: '15',
  cancellationPolicy: 'Puedes cancelar tu reserva hasta 4 horas antes del inicio de la clase sin penalización. Las cancelaciones tardías o no asistencias resultarán en la pérdida de la clase de tu paquete.',
}

// Solo claves conocidas: antes el POST aceptaba y persistía cualquier clave
// arbitraria (incluyendo secretos) sin validación
const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_SETTINGS))

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

    const entries = Object.entries(settings).filter(([key]) => ALLOWED_KEYS.has(key))

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Ninguna clave de configuración válida' },
        { status: 400 }
      )
    }

    // Validar numéricos (cancellationHours también gobierna ventanas de
    // reembolso — un NaN aquí rompe esos cálculos en silencio)
    for (const [key, value] of entries) {
      if (key === 'cancellationHours' || key === 'defaultCapacity') {
        const n = Number(value)
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return NextResponse.json(
            { error: `Valor inválido para ${key}: debe ser un número entre 0 y 100` },
            { status: 400 }
          )
        }
      }
    }

    // Upsert each setting
    const updatePromises = entries.map(([key, value]) =>
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
