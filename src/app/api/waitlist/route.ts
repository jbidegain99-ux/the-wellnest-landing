import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get user's waitlist entries
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const waitlistEntries = await prisma.waitlist.findMany({
      where: { userId: session.user.id },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
            _count: {
              select: { waitlist: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const items = waitlistEntries.map((entry) => ({
      id: entry.id,
      classId: entry.classId,
      className: entry.class.discipline.name,
      instructor: entry.class.instructor.name,
      dateTime: entry.class.dateTime,
      position: entry.position,
      totalInWaitlist: entry.class._count.waitlist,
      createdAt: entry.createdAt,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error fetching waitlist:', error)
    return NextResponse.json(
      { error: 'Error al obtener lista de espera' },
      { status: 500 }
    )
  }
}

// POST - Join waitlist
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { classId } = body

    if (!classId) {
      return NextResponse.json(
        { error: 'ID de clase requerido' },
        { status: 400 }
      )
    }

    // Check if class exists
    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      include: { discipline: true },
    })

    if (!classInfo) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    // Check if already on waitlist
    const existingEntry = await prisma.waitlist.findUnique({
      where: {
        userId_classId: {
          userId: session.user.id,
          classId,
        },
      },
    })

    if (existingEntry) {
      return NextResponse.json(
        { error: 'Ya estás en la lista de espera para esta clase' },
        { status: 400 }
      )
    }

    // Get current highest position
    const lastEntry = await prisma.waitlist.findFirst({
      where: { classId },
      orderBy: { position: 'desc' },
    })

    const newPosition = (lastEntry?.position || 0) + 1

    // Create waitlist entry
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        userId: session.user.id,
        classId,
        position: newPosition,
      },
    })

    console.log('[WAITLIST API] User joined waitlist:', {
      userId: session.user.id,
      classId,
      position: newPosition,
    })

    return NextResponse.json({
      success: true,
      message: `Te has unido a la lista de espera en posición #${newPosition}`,
      entry: {
        id: waitlistEntry.id,
        position: waitlistEntry.position,
        className: classInfo.discipline.name,
      },
    })
  } catch (error) {
    console.error('Error joining waitlist:', error)
    return NextResponse.json(
      { error: 'Error al unirse a la lista de espera' },
      { status: 500 }
    )
  }
}

// DELETE - Leave waitlist
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { waitlistId } = body

    if (!waitlistId) {
      return NextResponse.json(
        { error: 'ID de entrada requerido' },
        { status: 400 }
      )
    }

    // Find the entry
    const entry = await prisma.waitlist.findUnique({
      where: { id: waitlistId },
    })

    if (!entry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      )
    }

    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Delete entry and reorder positions
    await prisma.$transaction([
      prisma.waitlist.delete({
        where: { id: waitlistId },
      }),
      prisma.waitlist.updateMany({
        where: {
          classId: entry.classId,
          position: { gt: entry.position },
        },
        data: { position: { decrement: 1 } },
      }),
    ])

    console.log('[WAITLIST API] User left waitlist:', {
      userId: session.user.id,
      waitlistId,
    })

    return NextResponse.json({
      success: true,
      message: 'Has salido de la lista de espera',
    })
  } catch (error) {
    console.error('Error leaving waitlist:', error)
    return NextResponse.json(
      { error: 'Error al salir de la lista de espera' },
      { status: 500 }
    )
  }
}
