import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      include: {
        disciplines: {
          include: {
            discipline: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    })

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

    const pkg = await prisma.package.create({
      data: {
        name: body.name,
        shortDescription: body.shortDescription,
        fullDescription: body.fullDescription || body.shortDescription,
        classCount: body.classCount,
        price: body.price,
        validityDays: body.validityDays,
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
