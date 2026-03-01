import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { classId } = await params

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        discipline: { select: { id: true, name: true, slug: true } },
        instructor: { select: { id: true, name: true } },
        reservations: {
          where: { status: { in: ['CONFIRMED', 'ATTENDED'] } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
    }

    const result = {
      id: classData.id,
      dateTime: classData.dateTime.toISOString(),
      duration: classData.duration,
      classType: classData.classType,
      maxCapacity: classData.maxCapacity,
      discipline: classData.discipline,
      instructor: classData.instructor,
      reservations: classData.reservations.map((r) => ({
        id: r.id,
        status: r.status,
        checkedIn: r.checkedIn,
        checkedInAt: r.checkedInAt?.toISOString() || null,
        checkedInBy: r.checkedInBy,
        user: r.user,
        guestName: r.guestName,
        guestEmail: r.guestEmail,
        guestStatus: r.guestStatus,
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ATTENDANCE API] Error fetching class detail:', error)
    return NextResponse.json({ error: 'Error al obtener clase' }, { status: 500 })
  }
}
