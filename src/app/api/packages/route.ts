import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// Only return the 8 official packages
const OFFICIAL_PACKAGE_SLUGS = [
  'drop-in-class',
  'mini-flow-4',
  'balance-pass-8',
  'energia-total-12',
  'vital-plan-16',
  'full-access-24',
  'wellnest-trimestral-80',
  'special-balance-5',
]

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: {
        isActive: true,
        slug: { in: OFFICIAL_PACKAGE_SLUGS },
      },
      include: {
        disciplines: {
          include: {
            discipline: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    console.log(`[PACKAGES API] Returning ${packages.length} official packages`)

    return NextResponse.json(packages)
  } catch (error) {
    console.error('Error fetching packages:', error)
    return NextResponse.json(
      { error: 'Error al obtener los paquetes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Generate slug from name if not provided
    const slug = body.slug || body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const pkg = await prisma.package.create({
      data: {
        slug,
        name: body.name,
        subtitle: body.subtitle || null,
        shortDescription: body.shortDescription,
        fullDescription: body.fullDescription || body.shortDescription,
        classCount: body.classCount,
        price: body.price,
        currency: body.currency || 'USD',
        validityDays: body.validityDays,
        validityText: body.validityText || null,
        bulletsTop: body.bulletsTop || [],
        bulletsBottom: body.bulletsBottom || [],
        image: body.image,
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
      },
    })

    return NextResponse.json(pkg, { status: 201 })
  } catch (error) {
    console.error('Error creating package:', error)
    return NextResponse.json(
      { error: 'Error al crear el paquete' },
      { status: 500 }
    )
  }
}
