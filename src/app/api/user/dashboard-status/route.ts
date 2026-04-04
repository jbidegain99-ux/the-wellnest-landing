import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getNowInSV, formatInSV } from '@/lib/utils/timezone'
import { es } from 'date-fns/locale'
import { differenceInCalendarDays, isToday, isTomorrow } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

// Force dynamic - this route uses headers/session
export const dynamic = 'force-dynamic'

const TZ = 'America/El_Salvador'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const nowSV = getNowInSV()
    const nowUTC = new Date()

    // Find the active purchase (soonest expiring first)
    const purchase = await prisma.purchase.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: nowUTC },
      },
      include: {
        package: true,
      },
      orderBy: { expiresAt: 'asc' },
    })

    // Find the next confirmed/pending reservation
    const nextReservation = await prisma.reservation.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['CONFIRMED'] },
        class: {
          dateTime: { gt: nowUTC },
          isCancelled: false,
        },
      },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
          },
        },
      },
      orderBy: {
        class: {
          dateTime: 'asc',
        },
      },
    })

    // Build package response
    let packageData = null
    if (purchase) {
      const daysUntilExpiry = differenceInCalendarDays(
        toZonedTime(purchase.expiresAt, TZ),
        nowSV
      )
      const expiryDate = formatInSV(purchase.expiresAt, 'd MMM', { locale: es })

      packageData = {
        classesRemaining: purchase.classesRemaining,
        classesTotal: purchase.package.classCount,
        packageName: purchase.package.name,
        expiryDate,
        daysUntilExpiry,
        isWarning: daysUntilExpiry < 7,
      }
    }

    // Build next class response
    let nextClassData = null
    if (nextReservation) {
      const classDateTime = nextReservation.class.dateTime
      const classSV = toZonedTime(classDateTime, TZ)

      const classTime = formatInSV(classDateTime, 'h:mm a', { locale: es })

      // Determine date label
      let classDate: string
      if (isToday(classSV)) {
        classDate = 'Hoy'
      } else if (isTomorrow(classSV)) {
        classDate = 'Manana'
      } else {
        classDate = formatInSV(classDateTime, "EEE d MMM", { locale: es })
        // Capitalize first letter
        classDate = classDate.charAt(0).toUpperCase() + classDate.slice(1)
      }

      nextClassData = {
        className: nextReservation.class.discipline.name,
        classTime,
        classDate,
        instructor: nextReservation.class.instructor.name,
      }
    }

    return NextResponse.json({
      package: packageData,
      nextClass: nextClassData,
    })
  } catch (error) {
    console.error('Error fetching dashboard status:', error)
    return NextResponse.json(
      { error: 'Error al obtener el estado del dashboard' },
      { status: 500 }
    )
  }
}
