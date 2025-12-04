import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createDiscountCodeSchema = z.object({
  code: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
  percentage: z.number().min(1, 'El descuento mínimo es 1%').max(100, 'El descuento máximo es 100%'),
  maxUses: z.number().min(1).nullable().optional(),
  validFrom: z.string(),
  validUntil: z.string(),
  isActive: z.boolean().default(true),
  applicableTo: z.array(z.string()).default([]),
})

// GET - Fetch all discount codes for admin
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const discountCodes = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      discountCodes: discountCodes.map((dc) => ({
        id: dc.id,
        code: dc.code,
        percentage: dc.percentage,
        maxUses: dc.maxUses,
        currentUses: dc.currentUses,
        validFrom: dc.validFrom,
        validUntil: dc.validUntil,
        isActive: dc.isActive,
        applicableTo: dc.applicableTo,
        createdAt: dc.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching discount codes:', error)
    return NextResponse.json(
      { error: 'Error al obtener los códigos de descuento' },
      { status: 500 }
    )
  }
}

// POST - Create a new discount code
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createDiscountCodeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    // Normalize code to uppercase and trim
    const normalizedCode = data.code.toUpperCase().trim()

    // Check if code already exists
    const existingCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    })

    if (existingCode) {
      return NextResponse.json(
        { error: `El código "${normalizedCode}" ya existe` },
        { status: 400 }
      )
    }

    // Validate dates
    const validFrom = new Date(data.validFrom)
    const validUntil = new Date(data.validUntil)

    if (validUntil <= validFrom) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }

    // Create discount code
    const discountCode = await prisma.discountCode.create({
      data: {
        code: normalizedCode,
        percentage: data.percentage,
        maxUses: data.maxUses || null,
        currentUses: 0,
        validFrom,
        validUntil,
        isActive: data.isActive,
        applicableTo: data.applicableTo || [],
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Código de descuento creado correctamente',
      discountCode: {
        id: discountCode.id,
        code: discountCode.code,
        percentage: discountCode.percentage,
        maxUses: discountCode.maxUses,
        currentUses: discountCode.currentUses,
        validFrom: discountCode.validFrom,
        validUntil: discountCode.validUntil,
        isActive: discountCode.isActive,
        applicableTo: discountCode.applicableTo,
        createdAt: discountCode.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating discount code:', error)
    return NextResponse.json(
      { error: 'Error al crear el código de descuento' },
      { status: 500 }
    )
  }
}
