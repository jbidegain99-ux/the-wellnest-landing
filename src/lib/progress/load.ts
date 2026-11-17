import { prisma } from '@/lib/prisma'
import type { AttendedClass } from './summary'

// Clases a las que la usuaria asistió (excluye reservas de invitadas)
export async function loadAttendedClasses(userId: string): Promise<AttendedClass[]> {
  const rows = await prisma.reservation.findMany({
    where: { userId, status: 'ATTENDED', isGuestReservation: false },
    select: {
      class: {
        select: {
          id: true,
          dateTime: true,
          duration: true,
          classType: true,
          discipline: { select: { slug: true, name: true } },
        },
      },
    },
  })

  return rows.map(({ class: c }) => ({
    classId: c.id,
    dateTime: c.dateTime,
    durationMin: c.duration,
    disciplineSlug: c.discipline.slug,
    disciplineName: c.discipline.name,
    classType: c.classType,
  }))
}
