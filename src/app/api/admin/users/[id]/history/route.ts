import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface AuditEvent {
  id: string
  type: 'purchase' | 'assignment' | 'attendance' | 'cancellation'
  timestamp: string
  title: string
  description: string
  metadata: Record<string, string | number | null>
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = params.id

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Fetch all history sources in parallel
    const [purchases, reservations] = await Promise.all([
      // All purchases (including expired/depleted)
      prisma.purchase.findMany({
        where: { userId },
        include: {
          package: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // All reservations/bookings
      prisma.reservation.findMany({
        where: { userId },
        include: {
          class: {
            include: {
              discipline: { select: { name: true } },
              instructor: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const events: AuditEvent[] = []

    // Purchase events
    for (const p of purchases) {
      const isAdminAssigned = !p.paymentProviderId
      events.push({
        id: `purchase-${p.id}`,
        type: isAdminAssigned ? 'assignment' : 'purchase',
        timestamp: p.createdAt.toISOString(),
        title: isAdminAssigned
          ? `Paquete asignado: ${p.package.name}`
          : `Compra: ${p.package.name}`,
        description: isAdminAssigned
          ? `Asignado por administrador — ${p.package.name} (${p.classesRemaining}/${p.classesAllocated ?? p.originalPrice} clases)`
          : `${p.package.name} — $${p.finalPrice.toFixed(2)} ${p.discountCode ? `(codigo: ${p.discountCode})` : ''}`,
        metadata: {
          purchaseId: p.id,
          packageName: p.package.name,
          amount: p.finalPrice,
          status: p.status,
          classesRemaining: p.classesRemaining,
          expiresAt: p.expiresAt.toISOString(),
          paymentMethod: isAdminAssigned ? 'Offline' : 'PayWay',
        },
      })
    }

    // Reservation/attendance events
    for (const r of reservations) {
      const statusMap: Record<string, string> = {
        CONFIRMED: 'Confirmada',
        ATTENDED: 'Presente',
        CANCELLED: 'Cancelada',
        NO_SHOW: 'No asistio',
      }

      const typeMap: Record<string, AuditEvent['type']> = {
        CONFIRMED: 'attendance',
        ATTENDED: 'attendance',
        CANCELLED: 'cancellation',
        NO_SHOW: 'attendance',
      }

      events.push({
        id: `reservation-${r.id}`,
        type: typeMap[r.status] || 'attendance',
        timestamp: (r.cancelledAt || r.createdAt).toISOString(),
        title: `${r.class.discipline.name} — ${statusMap[r.status] || r.status}`,
        description: `Instructor: ${r.class.instructor.name} — ${new Date(r.class.dateTime).toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' })}`,
        metadata: {
          classId: r.classId,
          className: r.class.discipline.name,
          instructor: r.class.instructor.name,
          status: r.status,
          classDate: r.class.dateTime.toISOString(),
          checkedIn: r.checkedIn ? 'Si' : 'No',
        },
      })
    }

    // Sort all events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching user history:', error)
    return NextResponse.json(
      { error: 'Error al obtener el historial' },
      { status: 500 }
    )
  }
}
