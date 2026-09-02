/**
 * Correcciones manuales de asistencia para el cálculo de pago a instructores.
 *
 * Por qué existe: la asistencia se deriva de las reservas (status=ATTENDED o
 * checkedIn=true). Cuando entra gente a la clase que nunca quedó registrada en
 * la plataforma —invitados, alguien que llegó sin reservar, un check-in que no
 * se hizo— el conteo del sistema queda por debajo de la asistencia real y el
 * instructor cobra un tramo menor del que le toca.
 *
 * No se corrige creando reservas falsas: una reserva exige un `userId` y un
 * `purchaseId` reales, así que inventarlas contaminaría créditos, paquetes y
 * reportes de ventas. Además, en varios casos el equipo ni siquiera sabe quién
 * era la persona extra. Este registro corrige SOLO la asistencia usada para
 * pagar, y deja el rastro de auditoría (quién lo reportó, cuándo, por qué).
 *
 * `attendeesReported` es el TOTAL real de personas en la clase, no un delta:
 * si después alguien hace el check-in que faltaba, el total sigue siendo el
 * correcto en lugar de duplicarse.
 *
 * Para agregar una corrección: anotá el classId (visible en la hoja "Detalle
 * por Clase" del Excel), el total real, el conteo que tenía el sistema en ese
 * momento, y quién lo reportó.
 */

export interface AttendanceAdjustment {
  /** Class.id de la clase corregida. */
  classId: string
  /** Etiqueta legible (fecha, instructor, disciplina) para revisar el registro sin consultar la BD. */
  label: string
  /** Asistencia real total de la clase. Reemplaza al conteo derivado de reservas. */
  attendeesReported: number
  /** Conteo con check-in que tenía el sistema cuando se registró la corrección (auditoría). */
  attendeesInSystemAtRecord: number
  /** Por qué la asistencia real difiere del sistema. */
  reason: string
  /** Quién reportó la corrección. */
  reportedBy: string
  /** Fecha en que se registró la corrección (YYYY-MM-DD). */
  recordedAt: string
}

export const ATTENDANCE_ADJUSTMENTS: AttendanceAdjustment[] = [
  // --- Julio 2026 ---
  // Reportadas originalmente vía tasks/reports/ajustes-asistencia-15-28-jul-2026.json
  // y aplicadas a mano con send-instructor-payments-range.ts. Migradas acá para
  // que el cron mensual también las tome: el reporte automático del 1 de agosto
  // salió sin ellas.
  {
    classId: 'cmrdpjfz50011lotpzmiajqnw',
    label: '2026-07-16 8:30 AM · Florence Cervantes · Mat Pilates',
    attendeesReported: 3,
    attendeesInSystemAtRecord: 2,
    reason: '2 registradas + 1 no registrada = 3.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-07-28',
  },
  {
    classId: 'cmrdpjg050015lotpfu3igjig',
    label: '2026-07-16 6:15 PM · Camila Maravilla · Mat Pilates',
    attendeesReported: 6,
    attendeesInSystemAtRecord: 5,
    reason: '5 registradas + 1 no registrada = 6.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-07-28',
  },
  {
    classId: 'cmrdpofrm001ylotpm9p95jll',
    label: '2026-07-18 8:15 AM · Camila Maravilla · Mat Pilates',
    attendeesReported: 3,
    attendeesInSystemAtRecord: 2,
    reason: '2 registradas + 1 no registrada = 3.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-07-28',
  },
  {
    classId: 'cmrr3u8dq0000lj6h47kznt6p',
    label: '2026-07-24 7:00 AM · Camila Maravilla · Mat Pilates',
    attendeesReported: 4,
    attendeesInSystemAtRecord: 2,
    reason: '2 registradas + 2 no registradas = 4.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-07-28',
  },

  // --- Agosto 2026 ---
  {
    classId: 'cmso14l7u0004blnpv66f8x03',
    label: '2026-08-13 4:00 PM · Valeria Cortez · Yoga (Vinyasa)',
    attendeesReported: 4,
    attendeesInSystemAtRecord: 3,
    reason: 'Asistieron 4 personas. Las extra eran invitados de Andrea Robin, a quien se le descontó el crédito.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-08-31',
  },
  {
    classId: 'cmst8df3p0007lbxzutyrsflq',
    label: '2026-08-17 7:15 PM · Valeria Cortez · Yoga (Evening reset)',
    attendeesReported: 4,
    attendeesInSystemAtRecord: 3,
    reason: '3 inscritas en la plataforma y 4 personas en la clase. Falta confirmar quién era la cuarta.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-08-31',
  },
  {
    classId: 'cmt3jyv1200021ld2vvogli9w',
    label: '2026-08-28 7:15 PM · Eugenia Rivas · Telas',
    attendeesReported: 5,
    attendeesInSystemAtRecord: 3,
    reason: '3 inscritas y 2 personas extra que no estaban en la lista. Total 5 en la clase.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-08-31',
  },
  {
    classId: 'cmt4r12v6000012dwe2gstreg',
    label: '2026-08-28 5:50 PM · Adriana Bidegain · Terapia de Sonido',
    attendeesReported: 4,
    attendeesInSystemAtRecord: 3,
    reason: '3 inscritas en la plataforma y 4 personas en total en la clase.',
    reportedBy: 'Equipo Wellnest',
    recordedAt: '2026-08-31',
  },
]

const BY_CLASS_ID = new Map(ATTENDANCE_ADJUSTMENTS.map(a => [a.classId, a]))

export function getAttendanceAdjustment(classId: string): AttendanceAdjustment | undefined {
  return BY_CLASS_ID.get(classId)
}

/**
 * Asistencia a usar para pagar, dado el conteo derivado de reservas.
 * Sin corrección registrada devuelve el conteo del sistema tal cual.
 */
export function resolveAttendees(classId: string, attendeesFromReservations: number): number {
  const adj = BY_CLASS_ID.get(classId)
  return adj ? adj.attendeesReported : attendeesFromReservations
}
