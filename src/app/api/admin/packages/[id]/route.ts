import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePackageSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto').optional(),
  shortDescription: z.string().min(5, 'La descripción es muy corta').optional(),
  fullDescription: z.string().optional(),
  classCount: z.number().min(1, 'Debe tener al menos 1 clase').optional(),
  price: z.number().min(0, 'El precio no puede ser negativo').optional(),
  validityDays: z.number().min(1, 'La vigencia debe ser al menos 1 día').optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isShareable: z.boolean().optional(),
  maxShares: z.number().min(0).optional(),
})

// GET single package
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

    const pkg = await prisma.package.findUnique({
      where: { id },
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(pkg)
  } catch (error) {
    console.error('Error fetching package:', error)
    return NextResponse.json(
      { error: 'Error al obtener el paquete' },
      { status: 500 }
    )
  }
}

// PUT - update package
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
    const validation = updatePackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check if package exists
    const existingPackage = await prisma.package.findUnique({
      where: { id },
    })

    if (!existingPackage) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    const pkg = await prisma.package.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
        ...(data.fullDescription !== undefined && { fullDescription: data.fullDescription }),
        ...(data.classCount !== undefined && { classCount: data.classCount }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.validityDays !== undefined && { validityDays: data.validityDays }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(data.isShareable !== undefined && { isShareable: data.isShareable }),
        ...(data.maxShares !== undefined && { maxShares: data.maxShares }),
      },
    })

    // Revalidate public packages page
    revalidatePath('/paquetes')

    return NextResponse.json({
      message: 'Paquete actualizado correctamente',
      package: pkg,
    })
  } catch (error) {
    console.error('Error updating package:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el paquete' },
      { status: 500 }
    )
  }
}

// DELETE - remove package
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

    // Check if package exists
    const existingPackage = await prisma.package.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    })

    if (!existingPackage) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    // Check if there are active purchases
    if (existingPackage._count.purchases > 0) {
      // Soft delete - just deactivate
      await prisma.package.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json({
        message: 'Paquete desactivado (tiene compras asociadas)',
        softDeleted: true,
      })
    }

    // Hard delete if no purchases
    await prisma.package.delete({
      where: { id },
    })

    // Revalidate public packages page
    revalidatePath('/paquetes')

    return NextResponse.json({
      message: 'Paquete eliminado correctamente',
    })
  } catch (error) {
    console.error('Error deleting package:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el paquete' },
      { status: 500 }
    )
  }
}
