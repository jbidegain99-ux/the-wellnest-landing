import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateDiscountCodeSchema = z.object({
  code: z.string().min(3, 'El código debe tener al menos 3 caracteres').optional(),
  percentage: z.number().min(1).max(100).optional(),
  maxUses: z.number().min(1).nullable().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  isActive: z.boolean().optional(),
  applicableTo: z.array(z.string()).optional(),
})

// GET - Fetch a single discount code
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const discountCode = await prisma.discountCode.findUnique({
      where: { id },
    })

    if (!discountCode) {
      return NextResponse.json(
        { error: 'Código de descuento no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      discountCode,
    })
  } catch (error) {
    console.error('Error fetching discount code:', error)
    return NextResponse.json(
      { error: 'Error al obtener el código de descuento' },
      { status: 500 }
    )
  }
}

// PUT - Update a discount code
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateDiscountCodeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Check if discount code exists
    const existingCode = await prisma.discountCode.findUnique({
      where: { id },
    })

    if (!existingCode) {
      return NextResponse.json(
        { error: 'Código de descuento no encontrado' },
        { status: 404 }
      )
    }

    const data = validation.data
    const updateData: Record<string, unknown> = {}

    // If code is being updated, check for duplicates
    if (data.code !== undefined) {
      const normalizedCode = data.code.toUpperCase().trim()
      if (normalizedCode !== existingCode.code) {
        const duplicateCode = await prisma.discountCode.findUnique({
          where: { code: normalizedCode },
        })
        if (duplicateCode) {
          return NextResponse.json(
            { error: `El código "${normalizedCode}" ya existe` },
            { status: 400 }
          )
        }
        updateData.code = normalizedCode
      }
    }

    if (data.percentage !== undefined) updateData.percentage = data.percentage
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses
    if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom)
    if (data.validUntil !== undefined) updateData.validUntil = new Date(data.validUntil)
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.applicableTo !== undefined) updateData.applicableTo = data.applicableTo

    // Validate dates if both are being updated
    if (updateData.validFrom && updateData.validUntil) {
      if ((updateData.validUntil as Date) <= (updateData.validFrom as Date)) {
        return NextResponse.json(
          { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
          { status: 400 }
        )
      }
    }

    const discountCode = await prisma.discountCode.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'Código de descuento actualizado correctamente',
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
    console.error('Error updating discount code:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el código de descuento' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a discount code
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Check if discount code exists
    const existingCode = await prisma.discountCode.findUnique({
      where: { id },
    })

    if (!existingCode) {
      return NextResponse.json(
        { error: 'Código de descuento no encontrado' },
        { status: 404 }
      )
    }

    await prisma.discountCode.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Código de descuento eliminado correctamente',
    })
  } catch (error) {
    console.error('Error deleting discount code:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el código de descuento' },
      { status: 500 }
    )
  }
}
