/**
 * Reporte de pago a instructores para un RANGO DE FECHAS arbitrario.
 *
 * Misma lógica, mismo Excel y misma plantilla de email que el cron semanal de los
 * lunes (src/app/api/cron/instructor-payments/route.ts), pero con período y
 * destinatarios configurables.
 *
 * Uso:
 *   npx tsx scripts/send-instructor-payments-range.ts --from 2026-07-15 --to 2026-07-28 --email a@b.com
 *   ... agrega --send para enviar el correo (sin --send es preview).
 *   ... agrega --adjustments <ruta.json> para corregir asistencias a mano.
 *
 * --from / --to son fechas INCLUSIVAS en hora de El Salvador (UTC-6).
 * Las clases futuras del día de hoy no se incluyen (computeInstructorPayments
 * filtra por dateTime <= ahora).
 *
 * --adjustments apunta a un JSON [{classId, attendees, note}] para los casos que
 * el sistema no puede saber: personas que llegaron sin estar en la lista de
 * asistencia aunque sí se les dedujo crédito. Sobrescribe el conteo de asistentes
 * de esa clase, recalcula su tramo de pago y detalla los ajustes en el correo.
 * NO toca la base de datos.
 *
 * Es para correcciones de un solo uso. Las correcciones permanentes van en
 * src/lib/attendanceAdjustments.ts, que se aplica solo en TODOS los reportes
 * —incluidos los crons semanal y mensual, que no leen este flag—. Si una
 * corrección tiene que sobrevivir a una regeneración del reporte, va en el
 * registro, no en un JSON suelto.
 */

// Primero: carga .env + .env.local antes de cualquier módulo que lea process.env.
import './loadEnv'

import * as fs from 'fs'
import * as path from 'path'

const MONTHS_ES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function parseYmd(label: string, ymd: string): { y: number; mo: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`${label} debe ser YYYY-MM-DD (recibido: ${ymd})`)
  return { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) }
}

/** Bounds UTC de un rango inclusivo de días en hora SV (medianoche SV = 06:00 UTC). */
function rangeBoundsSV(fromYmd: string, toYmd: string): { start: Date; end: Date; label: string } {
  const f = parseYmd('--from', fromYmd)
  const t = parseYmd('--to', toYmd)
  const start = new Date(Date.UTC(f.y, f.mo, f.d, 6, 0, 0, 0))
  const end = new Date(Date.UTC(t.y, t.mo, t.d + 1, 6, 0, 0, 0)) // exclusivo: día siguiente al --to
  if (end <= start) throw new Error('--to debe ser igual o posterior a --from')
  const label =
    f.mo === t.mo && f.y === t.y
      ? `${f.d}-${t.d} ${MONTHS_ES_ABBR[f.mo]} ${f.y}`
      : `${f.d} ${MONTHS_ES_ABBR[f.mo]} - ${t.d} ${MONTHS_ES_ABBR[t.mo]} ${t.y}`
  return { start, end, label }
}

interface AttendanceAdjustment {
  classId: string
  attendees: number
  note: string
}

function loadAdjustments(file: string): AttendanceAdjustment[] {
  const raw: unknown = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'))
  if (!Array.isArray(raw)) throw new Error('El archivo de ajustes debe ser un array JSON')
  return raw.map((item, i) => {
    const o = item as Partial<AttendanceAdjustment>
    if (typeof o.classId !== 'string' || typeof o.attendees !== 'number' || typeof o.note !== 'string') {
      throw new Error(`Ajuste #${i + 1} inválido: requiere {classId: string, attendees: number, note: string}`)
    }
    return { classId: o.classId, attendees: o.attendees, note: o.note }
  })
}

/** Copia de la plantilla del cron semanal, con encabezado adaptado al rango. */
function buildEmailHtml(
  periodLabel: string,
  totals: { classes: number; bruto: number; neto: number; renta: number },
  adjustments: AttendanceAdjustment[] = [],
): string {
  const adjustmentsBlock = adjustments.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;">
              <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Ajustes manuales de asistencia</strong></p>
              <p style="margin:0 0 8px;font-size:12px;color:#6B7280;line-height:1.5;">Personas que llegaron al inicio de la clase sin estar en la lista de asistencia, pero a las que sí se les dedujo crédito. Se contaron para el cálculo del tramo de pago:</p>
              <ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.6;">
                ${adjustments.map((a) => `<li>${a.note}</li>`).join('\n                ')}
              </ul>
            </td></tr>
          </table>
          `
    : ''
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Pago a instructores — ${periodLabel}</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:20px;font-weight:600;">Reporte de pago a instructores</h1>
          <p style="color:#6B7280;margin:0 0 24px;font-size:14px;">Wellnest Studio · ${periodLabel}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Clases pagadas:</strong> ${totals.classes}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total bruto:</strong> $${totals.bruto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total neto (a pagar):</strong> $${totals.neto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Renta retenida (10%):</strong> $${totals.renta.toFixed(2)}</p>
            </td></tr>
          </table>
          ${adjustmentsBlock}<p style="color:#6B7280;font-size:13px;line-height:1.5;margin:16px 0 0;">Adjunto encontrarás el Excel con tres hojas: Resumen por Instructor, Detalle por Disciplina y Detalle por Clase. Reglas según escala vigente desde el 11 de Mayo 2026. Excluye clases canceladas, privadas (1:1) y reservas de usuarios de prueba.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Reescribe el conteo de asistentes de las clases ajustadas, recalcula su tramo
 * de pago y reconstruye resumen y totales (misma agregación que la librería).
 */
function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const send = args.includes('--send')
  const from = getFlag(args, '--from')
  const to = getFlag(args, '--to')
  const emailArg = getFlag(args, '--email')
  const adjustmentsPath = getFlag(args, '--adjustments')

  if (!from || !to) throw new Error('Faltan --from YYYY-MM-DD y --to YYYY-MM-DD')
  if (!emailArg) throw new Error('Falta --email destino1[,destino2]')

  const recipients = emailArg.split(',').map((s) => s.trim()).filter(Boolean)
  const bounds = rangeBoundsSV(from, to)
  const adjustments = adjustmentsPath ? loadAdjustments(adjustmentsPath) : []

  const { prisma } = await import('../src/lib/prisma')
  const { computeInstructorPayments, buildInstructorPaymentsExcel, applyAttendanceOverrides } = await import(
    '../src/lib/instructorPayments'
  )

  try {
    const raw = await computeInstructorPayments(prisma, bounds.start, bounds.end)
    const result = applyAttendanceOverrides(raw, adjustments)

    if (adjustments.length) {
      console.log(`\nAjustes manuales de asistencia (${adjustments.length}):`)
      for (const a of adjustments) {
        const before = raw.rows.find((r) => r.classId === a.classId)
        const after = result.rows.find((r) => r.classId === a.classId)
        console.log(
          `  · ${a.note}\n      asistentes ${before?.attendees} → ${after?.attendees} · neto $${before?.neto.toFixed(2)} → $${after?.neto.toFixed(2)}`,
        )
      }
      console.log(
        `  Δ total neto: $${raw.totalNeto.toFixed(2)} → $${result.totalNeto.toFixed(2)} (+$${(result.totalNeto - raw.totalNeto).toFixed(2)})`,
      )
    }

    console.log(`\nPeríodo: ${bounds.label}  (${bounds.start.toISOString()} → ${bounds.end.toISOString()})`)
    console.log(
      `Clases: ${result.classesCounted} · bruto $${result.totalBruto.toFixed(2)} · neto $${result.totalNeto.toFixed(2)} · renta $${result.totalRenta.toFixed(2)}`,
    )
    for (const row of result.summaryByInstructor) {
      console.log(`  - ${row.instructorName}: ${row.classes} clases · neto $${row.totalNeto.toFixed(2)}`)
    }
    console.log(`Destinatarios: ${recipients.join(', ')}`)

    if (result.classesCounted === 0) {
      console.log('⚠ Sin clases en el período. Abortando.')
      return
    }

    const buf = buildInstructorPaymentsExcel(result, bounds.label)
    const filename = `pago_instructores_${bounds.label.replace(/\s+/g, '_').replace(/-/g, '_')}.xlsx`

    if (!send) {
      const outPath = path.resolve(process.cwd(), 'tasks/reports', filename)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
      console.log(`\n(preview) Excel guardado en ${outPath} — agrega --send para enviar el correo.`)
      return
    }

    const { sendEmail } = await import('../src/lib/emailService')
    const emailResult = await sendEmail({
      to: recipients,
      subject: `Pago a instructores — ${bounds.label}`,
      html: buildEmailHtml(
        bounds.label,
        {
          classes: result.classesCounted,
          bruto: result.totalBruto,
          neto: result.totalNeto,
          renta: result.totalRenta,
        },
        adjustments,
      ),
      attachments: [
        {
          filename,
          contentBase64: buf.toString('base64'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    if (!emailResult.success) {
      console.error(`\n❌ Falló el envío: ${emailResult.error}`)
      process.exitCode = 1
      return
    }
    console.log(`\n✅ Enviado: "${filename}" → ${recipients.join(', ')}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
