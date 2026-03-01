import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const packageSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto'),
  slug: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  shortDescription: z.string().min(5, 'La descripción es muy corta'),
  fullDescription: z.string().optional(),
  classCount: z.number().min(1, 'Debe tener al menos 1 clase'),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  currency: z.string().optional().default('USD'),
  validityDays: z.number().min(1, 'La vigencia debe ser al menos 1 día'),
  validityText: z.string().nullable().optional(),
  bulletsTop: z.array(z.string()).optional().default([]),
  bulletsBottom: z.array(z.string()).optional().default([]),
  originalPrice: z.number().nullable().optional(),
  discountPercent: z.number().nullable().optional(),
  isShareable: z.boolean().optional().default(false),
  maxShares: z.number().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
})

// GET packages (admin view)
// Returns all packages so admins can manage them
// Pass ?active=true to filter only active packages
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    const packages = await prisma.package.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { order: 'asc' },
      take: 25,
    })

    console.log(`[ADMIN PACKAGES API] Returning ${packages.length} packages (activeOnly: ${activeOnly})`)

    return NextResponse.json(packages)
  } catch (error) {
    console.error('Error fetching packages:', error)
    return NextResponse.json(
      { error: 'Error al obtener los paquetes' },
      { status: 500 }
    )
  }
}

// POST - create new package
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = packageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get the highest order number
    const lastPackage = await prisma.package.findFirst({
      orderBy: { order: 'desc' },
    })
    const newOrder = (lastPackage?.order ?? 0) + 1

    // Generate slug from name if not provided
    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const pkg = await prisma.package.create({
      data: {
        name: data.name,
        slug,
        subtitle: data.subtitle || null,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription || data.shortDescription,
        classCount: data.classCount,
        price: data.price,
        currency: data.currency || 'USD',
        validityDays: data.validityDays,
        validityText: data.validityText || null,
        bulletsTop: data.bulletsTop || [],
        bulletsBottom: data.bulletsBottom || [],
        isShareable: data.isShareable,
        maxShares: data.maxShares,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        order: newOrder,
      },
    })

    // Revalidate public packages page
    revalidatePath('/paquetes')

    return NextResponse.json({
      message: 'Paquete creado correctamente',
      package: pkg,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating package:', error)
    return NextResponse.json(
      { error: 'Error al crear el paquete' },
      { status: 500 }
    )
  }
}
