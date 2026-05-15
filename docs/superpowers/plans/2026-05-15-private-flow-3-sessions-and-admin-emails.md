# Private Flow 3 Sesiones + Admin Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar Private Flow a 3 sesiones por compra (los 3 slots se convierten en reservas reales al aprobar la admin), y redirigir las notificaciones de nueva sesión privada únicamente a `contact@wellneststudio.net`.

**Architecture:** Schema cambia de 1-a-1 (`PrivateSessionRequest.confirmedClassId`) a 1-a-N vía nuevo FK `Class.privateSessionRequestId`. El endpoint de confirmación admin bifurca entre rama legacy (slot2/slot3 null → 1 sesión) y rama nueva (3 slots → 3 Class + 3 Reservation, atómico). El form usuaria endurece a 3 slots obligatorios y la notificación admin colapsa a un solo destinatario.

**Tech Stack:** Next.js 15 App Router, Prisma (Postgres, `db push` sin migrations folder), zod, vitest, NextAuth.

**Spec base:** `docs/superpowers/specs/2026-05-15-private-flow-3-sessions-and-admin-emails-design.md`

---

## Task 1: Schema — agregar Class.privateSessionRequestId + aflojar @unique

**Files:**
- Modify: `prisma/schema.prisma:228-307`

- [ ] **Step 1: Editar `model PrivateSessionRequest`**

Reemplazar las líneas 249-250:
```prisma
  confirmedClassId      String?               @unique
  confirmedClass        Class?                @relation("ConfirmedPrivateSession", fields: [confirmedClassId], references: [id])
```
por:
```prisma
  confirmedClassId      String?               // tag histórico legacy (1 sesión)
  confirmedClasses      Class[]               @relation("PrivateSessionConfirmedClasses")
```

- [ ] **Step 2: Editar `model Class`**

Reemplazar la línea 306:
```prisma
  privateSessionRequest   PrivateSessionRequest? @relation("ConfirmedPrivateSession")
```
por:
```prisma
  privateSessionRequestId String?
  privateSessionRequest   PrivateSessionRequest? @relation("PrivateSessionConfirmedClasses", fields: [privateSessionRequestId], references: [id], onDelete: SetNull)

  @@index([privateSessionRequestId])
```

(Nota: si `model Class` ya tiene un bloque `@@index([…])` u otros índices al final, agregar el `@@index` correspondiente en ese bloque. Si no, añadirlo justo antes del `}` de cierre.)

- [ ] **Step 3: Validar el schema**

```bash
npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Aplicar al DB**

```bash
npx prisma db push
```
Expected: cambios aplicados. Si Prisma pide confirmación por "data loss" sobre `confirmedClassId` (al quitar `@unique`), aceptar — los valores se conservan.

- [ ] **Step 5: Regenerar cliente Prisma**

```bash
npx prisma generate
```
Expected: `Generated Prisma Client …`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): Class.privateSessionRequestId for N classes per request"
```

---

## Task 2: Script de migración de compras vigentes (1 → 3 sesiones)

**Files:**
- Create: `scripts/migrate-private-flow-to-3-sessions.ts`

- [ ] **Step 1: Crear el script**

```ts
/**
 * Migración one-shot: Private Flow pasa de 1 a 3 sesiones por compra.
 *
 * Sólo migra compras ACTIVE con classesRemaining=1 de paquetes isPrivate
 * que NO tengan una PrivateSessionRequest en estado PENDING o CONFIRMED.
 * Las compras con solicitud en curso se omiten y se loguean para revisión
 * manual (siguen funcionando con flujo legacy de 1 sesión).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n→ Buscando compras Private Flow vigentes a migrar...\n')

  const candidates = await prisma.purchase.findMany({
    where: {
      status: 'ACTIVE',
      classesRemaining: 1,
      package: { isPrivate: true },
      NOT: {
        privateSessionRequests: {
          some: { status: { in: ['PENDING', 'CONFIRMED'] } },
        },
      },
    },
    include: {
      user: { select: { email: true, name: true } },
      package: { select: { name: true } },
    },
  })

  const skipped = await prisma.purchase.findMany({
    where: {
      status: 'ACTIVE',
      classesRemaining: 1,
      package: { isPrivate: true },
      privateSessionRequests: {
        some: { status: { in: ['PENDING', 'CONFIRMED'] } },
      },
    },
    include: {
      user: { select: { email: true } },
      privateSessionRequests: { select: { id: true, status: true } },
    },
  })

  console.log(`Candidatos a migrar: ${candidates.length}`)
  for (const c of candidates) {
    console.log(`  - ${c.id}  ${c.user.name ?? c.user.email}  (${c.package.name})`)
  }
  console.log(`\nOmitidas (con solicitud activa): ${skipped.length}`)
  for (const s of skipped) {
    const reqs = s.privateSessionRequests.map((r) => `${r.id}:${r.status}`).join(', ')
    console.log(`  - ${s.id}  ${s.user.email}  [${reqs}]`)
  }

  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN] No se hicieron cambios.')
    return
  }

  if (candidates.length === 0) {
    console.log('\nNada que migrar.')
    return
  }

  const result = await prisma.purchase.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { classesRemaining: 3 },
  })
  console.log(`\n✓ Actualizadas ${result.count} compras a classesRemaining=3`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Dry run para verificar candidatos**

```bash
npx tsx scripts/migrate-private-flow-to-3-sessions.ts --dry-run
```
Expected: lista de candidatos y omitidas, sin escribir.

- [ ] **Step 3: Ejecutar la migración en vivo**

```bash
npx tsx scripts/migrate-private-flow-to-3-sessions.ts
```
Expected: `✓ Actualizadas N compras a classesRemaining=3`.

- [ ] **Step 4: Verificar con SQL/Prisma Studio o un quick check**

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.purchase.count({where:{status:'ACTIVE',classesRemaining:3,package:{isPrivate:true}}}).then(n=>console.log('ACTIVE Private Flow con 3 sesiones:',n)).finally(()=>p.\$disconnect())"
```
Expected: número > 0 (cantidad migrada + cualquiera que ya tenía 3).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-private-flow-to-3-sessions.ts
git commit -m "chore(migrate): Private Flow 1→3 classesRemaining for active purchases"
```

---

## Task 3: Seed canónico de Private Flow → 3 sesiones

**Files:**
- Modify: `scripts/seed-new-packages-2026-04.ts:130-156`

- [ ] **Step 1: Reemplazar el bloque del paquete Private Flow**

Reemplazar las líneas 128-156 (header comment + upsertPackage call) por:
```ts
  // ──────────────────────────────────────────────────────────────────
  // 2. Private Flow — $45, 3 clases privadas 1:1
  // ──────────────────────────────────────────────────────────────────
  const privateFlow = await upsertPackage({
    slug: 'private-flow',
    name: 'Private Flow (3 clases)',
    subtitle: 'Tres sesiones personalizadas para ti',
    shortDescription: 'Tres sesiones personalizadas para ti',
    fullDescription:
      'Tres sesiones diseñadas según tus necesidades, ritmo y objetivos. Ideal para ' +
      'profundizar en tu práctica, recibir guía cercana y vivir un espacio de ' +
      'movimiento totalmente adaptado a ti.',
    classCount: 3,
    price: 45.0,
    validityDays: 30,
    bulletsTop: [
      '3 clases privadas',
      'Atención 1:1',
      'Experiencia personalizada',
    ],
    bulletsBottom: [
      'Ideal para acompañamiento personalizado',
      'Todas las disciplinas disponibles según enfoque',
      'Reserva fácil desde la app',
      'Reprograma con 8 horas de anticipación',
    ],
    order: -1,
    isPrivate: true,
  })
```

- [ ] **Step 2: Correr el seed**

```bash
npx tsx scripts/seed-new-packages-2026-04.ts
```
Expected: log de upsert sin errores, `✅ Seed complete.`

- [ ] **Step 3: Verificar el paquete en BD**

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.package.findUnique({where:{slug:'private-flow'},select:{name:true,classCount:true,price:true,isPrivate:true}}).then(r=>console.log(r)).finally(()=>p.\$disconnect())"
```
Expected: `{ name: 'Private Flow (3 clases)', classCount: 3, price: 45, isPrivate: true }`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-new-packages-2026-04.ts
git commit -m "feat(seed): Private Flow → 3 clases privadas, mismo precio"
```

---

## Task 4: emailService templates — admin notif + confirmación (TDD)

**Files:**
- Modify: `src/lib/emailService.ts:1027-1126`
- Modify: `src/lib/emailService.test.ts`

- [ ] **Step 1: Escribir test para `buildAdminPrivateSessionNotification`**

Agregar al final de `src/lib/emailService.test.ts`:
```ts
import {
  buildAdminPrivateSessionNotification,
  buildPrivateSessionConfirmationEmail,
} from './emailService'

describe('buildAdminPrivateSessionNotification', () => {
  const slot1 = new Date('2026-06-01T18:00:00.000Z')
  const slot2 = new Date('2026-06-03T18:00:00.000Z')
  const slot3 = new Date('2026-06-05T18:00:00.000Z')
  const baseData = {
    userName: 'María',
    userEmail: 'maria@example.com',
    disciplineName: 'Yoga',
    instructorName: 'Valeria',
    slot1,
    slot2,
    slot3,
    notes: null,
    requestId: 'req_123',
  }

  it('renders the 3 sessions with "Sesión N" labels', () => {
    const html = buildAdminPrivateSessionNotification(baseData)
    expect(html).toContain('Sesi&oacute;n 1')
    expect(html).toContain('Sesi&oacute;n 2')
    expect(html).toContain('Sesi&oacute;n 3')
  })

  it('does not use the old "Opción N" wording', () => {
    const html = buildAdminPrivateSessionNotification(baseData)
    expect(html).not.toContain('Opci&oacute;n 1')
    expect(html).not.toContain('Ventanas')
  })

  it('falls back to legacy single-slot rendering when slot2/slot3 are null', () => {
    const html = buildAdminPrivateSessionNotification({
      ...baseData,
      slot2: null,
      slot3: null,
    })
    expect(html).toContain('Sesi&oacute;n 1')
    expect(html).not.toContain('Sesi&oacute;n 2')
  })
})

describe('buildPrivateSessionConfirmationEmail', () => {
  const baseData = {
    userName: 'María',
    sessions: [
      { dateTime: 'lun, 1 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
      { dateTime: 'mié, 3 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
      { dateTime: 'vie, 5 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
    ],
  }

  it('renders all 3 session dates', () => {
    const html = buildPrivateSessionConfirmationEmail(baseData)
    expect(html).toContain('lun, 1 jun 2026')
    expect(html).toContain('mié, 3 jun 2026')
    expect(html).toContain('vie, 5 jun 2026')
  })

  it('greets by name when provided', () => {
    const html = buildPrivateSessionConfirmationEmail(baseData)
    expect(html).toContain('Hola María')
  })

  it('falls back to plain greeting when name is null', () => {
    const html = buildPrivateSessionConfirmationEmail({ ...baseData, userName: null })
    expect(html).toMatch(/Hola[^<]*<\/p>/)
    expect(html).not.toContain('Hola null')
  })
})
```

- [ ] **Step 2: Correr tests y verificar que fallan**

```bash
npx vitest run src/lib/emailService.test.ts
```
Expected: FAIL — los tests de la confirmación fallan porque el shape `sessions` no existe aún; los de admin notif pueden pasar parcialmente.

- [ ] **Step 3: Reemplazar `buildAdminPrivateSessionNotification`**

Reemplazar líneas 1039-1083 en `src/lib/emailService.ts`. El nuevo bloque sigue aceptando el mismo `AdminPrivateSessionNotificationData` (slot2/slot3 nullable para compat), pero cambia labels y copy:

```ts
export function buildAdminPrivateSessionNotification(data: AdminPrivateSessionNotificationData): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://wellneststudio.net'
  const adminUrl = `${baseUrl}/admin/sesiones-privadas`

  const slotLines = [data.slot1, data.slot2, data.slot3]
    .map((s, i) => s ? `<li style="margin:4px 0;">Sesi&oacute;n ${i + 1}: ${formatDateTimeShort(s)}</li>` : null)
    .filter((line): line is string => line != null)
    .join('')

  const sectionTitle = data.slot2 && data.slot3
    ? 'Sesiones agendadas:'
    : 'Sesi&oacute;n solicitada:'

  const instructorRow = data.instructorName
    ? `<p style="margin:6px 0;"><strong>Instructor preferido:</strong> ${data.instructorName}</p>`
    : '<p style="margin:6px 0;color:#6B7280;"><em>Sin preferencia de instructor</em></p>'

  const notesRow = data.notes
    ? `<p style="margin:12px 0 6px;"><strong>Notas:</strong></p><p style="margin:0;color:#374151;white-space:pre-wrap;">${data.notes}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Nueva solicitud de sesi&oacute;n privada</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:20px;font-weight:600;">Nueva solicitud de sesi&oacute;n privada</h1>
          <p style="color:#6B7280;margin:0 0 24px;font-size:14px;">Wellnest Studio</p>
          <p style="margin:0 0 4px;"><strong>Cliente:</strong> ${data.userName}</p>
          <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">${data.userEmail}</p>
          <p style="margin:6px 0;"><strong>Disciplina solicitada:</strong> ${data.disciplineName}</p>
          ${instructorRow}
          <p style="margin:16px 0 6px;"><strong>${sectionTitle}</strong></p>
          <ul style="margin:0 0 16px;padding-left:20px;color:#374151;">${slotLines}</ul>
          ${notesRow}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
            <tr><td align="center">
              <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;background:#453C34;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Revisar y confirmar</a>
            </td></tr>
          </table>
          <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;text-align:center;">Request ID: ${data.requestId}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
```

- [ ] **Step 4: Reemplazar `PrivateSessionConfirmationData` + `buildPrivateSessionConfirmationEmail`**

Reemplazar líneas 1085-1126:

```ts
export interface PrivateSessionConfirmationSession {
  dateTime: string
  disciplineName: string
  instructorName: string
  duration: number
}

export interface PrivateSessionConfirmationData {
  userName: string | null
  sessions: PrivateSessionConfirmationSession[]
}

export function buildPrivateSessionConfirmationEmail(data: PrivateSessionConfirmationData): string {
  const greeting = data.userName ? `Hola ${data.userName}` : 'Hola'
  const baseUrl = process.env.NEXTAUTH_URL || 'https://wellneststudio.net'

  const sessionsBlock = data.sessions
    .map(
      (s, i) => `<tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:8px;">
            <p style="margin:0 0 8px;font-weight:600;color:#1F2937;">Sesi&oacute;n ${i + 1}</p>
            <p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Disciplina:</strong> ${s.disciplineName}</p>
            <p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Instructor:</strong> ${s.instructorName}</p>
            <p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Fecha y hora:</strong> ${s.dateTime}</p>
            <p style="margin:4px 0;font-size:14px;color:#374151;"><strong>Duraci&oacute;n:</strong> ${s.duration} minutos</p>
          </td></tr><tr><td style="height:8px;"></td></tr>`
    )
    .join('')

  const heading = data.sessions.length > 1
    ? '&iexcl;Tus sesiones privadas est&aacute;n listas!'
    : '&iexcl;Tu sesi&oacute;n privada est&aacute; lista!'

  const intro = data.sessions.length > 1
    ? `Hemos confirmado tus ${data.sessions.length} sesiones privadas 1:1. Aqu&iacute; est&aacute;n los detalles:`
    : 'Hemos confirmado tu sesi&oacute;n privada 1:1. Aqu&iacute; est&aacute;n los detalles:'

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Sesiones privadas confirmadas</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:22px;font-weight:600;text-align:center;">${heading}</h1>
          <p style="color:#6B7280;margin:0 0 28px;font-size:14px;text-align:center;">Wellnest</p>
          <p style="color:#374151;font-size:16px;font-weight:500;margin:0 0 16px;">${greeting},</p>
          <p style="color:#6B7280;margin:0 0 24px;font-size:15px;line-height:1.5;">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
            ${sessionsBlock}
          </table>
          <p style="color:#6B7280;margin:16px 0;font-size:14px;line-height:1.5;">Recuerda llegar unos minutos antes. Si necesit&aacute;s reprogramar con al menos 8 horas de anticipaci&oacute;n, contactanos desde tu perfil.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
            <tr><td align="center">
              <a href="${baseUrl}/perfil/reservas" style="display:inline-block;padding:12px 24px;background:#453C34;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Ver mis reservas</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
```

- [ ] **Step 5: Correr tests y verificar que pasan**

```bash
npx vitest run src/lib/emailService.test.ts
```
Expected: PASS (todos los nuevos tests + los existentes de waitlist).

- [ ] **Step 6: Commit**

```bash
git add src/lib/emailService.ts src/lib/emailService.test.ts
git commit -m "feat(email): admin notif y confirmación soportan 3 sesiones"
```

---

## Task 5: POST /api/private-sessions — slot2/3 requeridos, 3 distintas, admin email fijo

**Files:**
- Modify: `src/app/api/private-sessions/route.ts:17-25, 96-132, 191-241`

- [ ] **Step 1: Endurecer `createRequestSchema`**

Reemplazar líneas 17-25:
```ts
const createRequestSchema = z
  .object({
    purchaseId: z.string().min(1),
    preferredDisciplineId: z.string().min(1, 'Selecciona una disciplina'),
    preferredInstructorId: z.string().optional().nullable(),
    preferredSlot1: z.string().datetime({ message: 'Primera fecha/hora requerida' }),
    preferredSlot2: z.string().datetime({ message: 'Segunda fecha/hora requerida' }),
    preferredSlot3: z.string().datetime({ message: 'Tercera fecha/hora requerida' }),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) => new Set([d.preferredSlot1, d.preferredSlot2, d.preferredSlot3]).size === 3,
    { message: 'Las 3 fechas deben ser distintas', path: ['preferredSlot2'] }
  )
```

- [ ] **Step 2: Cambiar manejo de `slot2`/`slot3` en POST (ya no nullable)**

Reemplazar el bloque líneas 111-132. Antes:
```ts
    const slot1 = new Date(data.preferredSlot1)
    const slot2 = data.preferredSlot2 ? new Date(data.preferredSlot2) : null
    const slot3 = data.preferredSlot3 ? new Date(data.preferredSlot3) : null
    if (slot1 <= now) { /* … */ }
    if (slot2 && slot2 <= now) { /* … */ }
    if (slot3 && slot3 <= now) { /* … */ }
```
Por:
```ts
    const slot1 = new Date(data.preferredSlot1)
    const slot2 = new Date(data.preferredSlot2)
    const slot3 = new Date(data.preferredSlot3)
    if (slot1 <= now || slot2 <= now || slot3 <= now) {
      return NextResponse.json(
        { error: 'Las 3 fechas deben ser a futuro' },
        { status: 400 }
      )
    }
```

- [ ] **Step 3: Validar `classesRemaining >= 3`**

Reemplazar el bloque líneas 73-88 (la consulta `prisma.purchase.findFirst`). Cambiar el `classesRemaining: { gt: 0 }` a `classesRemaining: { gte: 3 }` y ajustar el mensaje de error:
```ts
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: data.purchaseId,
        userId,
        status: 'ACTIVE',
        classesRemaining: { gte: 3 },
        expiresAt: { gt: now },
      },
      include: { package: true },
    })
    if (!purchase) {
      return NextResponse.json(
        { error: 'Paquete no válido, vencido o sin las 3 sesiones disponibles' },
        { status: 400 }
      )
    }
```

- [ ] **Step 4: Cambiar destinatario admin a Adriana López**

Reemplazar las líneas 201-218 (todo el bloque que arma `recipients`):
```ts
  // Notificación: sólo a Adriana López (override opcional por env var)
  const ADMIN_NOTIFICATION_EMAIL = 'contact@wellneststudio.net'
  const recipients = [process.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_NOTIFICATION_EMAIL]
```

(Quita la rama que consulta `prisma.user.findMany({ where: { role: 'ADMIN' } })`.)

- [ ] **Step 5: Smoke check del endpoint con curl/HTTP**

Levantar dev server en otra terminal: `npm run dev`

Probar con un cuerpo malo (slots iguales):
```bash
curl -X POST http://localhost:3000/api/private-sessions \
  -H "Content-Type: application/json" \
  -H "Cookie: <pega aquí tu cookie de sesión>" \
  -d '{"purchaseId":"<id>","preferredDisciplineId":"<id>","preferredSlot1":"2026-12-01T18:00:00.000Z","preferredSlot2":"2026-12-01T18:00:00.000Z","preferredSlot3":"2026-12-02T18:00:00.000Z"}'
```
Expected: `400` con `{"error":"Las 3 fechas deben ser distintas"}`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/private-sessions/route.ts
git commit -m "feat(api): endurece /api/private-sessions a 3 slots + admin email fijo"
```

---

## Task 6: PATCH /api/admin/private-sessions/[id] — rama nueva 3 sesiones

**Files:**
- Modify: `src/app/api/admin/private-sessions/[id]/route.ts` (entero)

- [ ] **Step 1: Reemplazar los schemas zod**

Reemplazar líneas 36-51:
```ts
// Reject: shared
const rejectSchema = z.object({
  action: z.literal('reject'),
  rejectedReason: z.string().max(2000).optional().nullable(),
  adminNotes: z.string().max(2000).optional().nullable(),
})

// Legacy confirm (1 sesión): for requests with slot2 OR slot3 null
const confirmSchemaLegacy = z.object({
  action: z.literal('confirm'),
  instructorId: z.string().min(1),
  disciplineId: z.string().min(1),
  dateTime: z.string().datetime(),
  duration: z.number().int().positive().default(60),
  adminNotes: z.string().max(2000).optional().nullable(),
})

// New confirm (3 sesiones): for requests with all 3 slots
const sessionEditSchema = z.object({
  dateTime: z.string().datetime(),
  instructorId: z.string().min(1),
  duration: z.number().int().positive().default(60),
})
const confirmSchemaNew = z.object({
  action: z.literal('confirm'),
  disciplineId: z.string().min(1),
  sessions: z.array(sessionEditSchema).length(3),
  adminNotes: z.string().max(2000).optional().nullable(),
})
```

(Eliminar el `patchSchema = z.discriminatedUnion(...)` original.)

- [ ] **Step 2: Reescribir el bloque de validación de body**

Reemplazar líneas 63-72 (parse del body) y el resto del handler para bifurcar legacy/nuevo. Justo después de `const { id: requestId } = await params`:

```ts
    const body = await request.json()
    const action = body?.action

    // Carga del request primero (necesitamos saber si es legacy)
    const sessionRequest = await prisma.privateSessionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        purchase: { include: { package: true } },
        preferredDiscipline: { select: { name: true } },
      },
    })
    if (!sessionRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (sessionRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Esta solicitud ya está ${sessionRequest.status.toLowerCase()} y no puede modificarse.` },
        { status: 400 }
      )
    }

    const isLegacy = sessionRequest.preferredSlot2 === null || sessionRequest.preferredSlot3 === null

    // REJECT compartido
    if (action === 'reject') {
      const rj = rejectSchema.safeParse(body)
      if (!rj.success) {
        return NextResponse.json(
          { error: rj.error.errors[0]?.message || 'Datos inválidos' },
          { status: 400 }
        )
      }
      // … existing reject logic, reusando sessionRequest …
    } else if (action !== 'confirm') {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    } else if (isLegacy) {
      const cv = confirmSchemaLegacy.safeParse(body)
      if (!cv.success) {
        return NextResponse.json(
          { error: cv.error.errors[0]?.message || 'Datos inválidos' },
          { status: 400 }
        )
      }
      // … legacy confirm branch (idéntico al actual: 1 Class + 1 Reservation + decremento 1) …
    } else {
      const cv = confirmSchemaNew.safeParse(body)
      if (!cv.success) {
        return NextResponse.json(
          { error: cv.error.errors[0]?.message || 'Datos inválidos' },
          { status: 400 }
        )
      }
      // … new confirm branch (3 Class + 3 Reservation + decremento 3) …
    }
```

- [ ] **Step 3: Mantener la rama legacy idéntica**

La rama `isLegacy === true` ejecuta el mismo código que hoy: pre-flight (fecha futura, classesRemaining > 0, status ACTIVE, discipline/instructor existen), transacción que crea 1 Class + 1 Reservation + decremento 1 + update request (status=CONFIRMED, confirmedClassId=createdClass.id, confirmedAt, confirmedBy, adminNotes). Conserva el set de `confirmedClassId` para que aparezca como tag histórico. Cierra con email `buildPrivateSessionConfirmationEmail({ userName, sessions: [{ disciplineName, instructorName, dateTime: formatDateTimeFull(...), duration }] })` (ahora pasa un array de 1).

- [ ] **Step 4: Escribir la rama nueva 3 sesiones**

Reemplazar el resto del handler con la transacción de 3 sesiones. Esqueleto:
```ts
      const data = cv.data
      const now = new Date()
      const dateTimes = data.sessions.map((s) => new Date(s.dateTime))
      if (dateTimes.some((d) => d <= now)) {
        return NextResponse.json({ error: 'Todas las fechas deben ser a futuro' }, { status: 400 })
      }
      if (new Set(dateTimes.map((d) => d.toISOString())).size !== 3) {
        return NextResponse.json({ error: 'Las 3 fechas deben ser distintas' }, { status: 400 })
      }
      if (sessionRequest.purchase.classesRemaining < 3) {
        return NextResponse.json(
          { error: 'El paquete no tiene 3 sesiones disponibles' },
          { status: 400 }
        )
      }
      if (sessionRequest.purchase.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: `El paquete del usuario está ${sessionRequest.purchase.status}` },
          { status: 400 }
        )
      }

      const discipline = await prisma.discipline.findUnique({ where: { id: data.disciplineId } })
      if (!discipline) {
        return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 400 })
      }
      const instructorIds = Array.from(new Set(data.sessions.map((s) => s.instructorId)))
      const instructors = await prisma.instructor.findMany({ where: { id: { in: instructorIds } } })
      if (instructors.length !== instructorIds.length) {
        return NextResponse.json({ error: 'Instructor no encontrado' }, { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
        const created = [] as { id: string; dateTime: Date; duration: number; instructorId: string }[]
        for (const s of data.sessions) {
          const c = await tx.class.create({
            data: {
              disciplineId: data.disciplineId,
              instructorId: s.instructorId,
              dateTime: new Date(s.dateTime),
              duration: s.duration,
              maxCapacity: 1,
              currentCount: 0,
              isPrivate: true,
              classType: 'Sesión privada',
              privateSessionRequestId: sessionRequest.id,
            },
          })
          await tx.reservation.create({
            data: {
              userId: sessionRequest.userId,
              classId: c.id,
              purchaseId: sessionRequest.purchaseId,
              status: 'CONFIRMED',
            },
          })
          created.push({ id: c.id, dateTime: c.dateTime, duration: c.duration, instructorId: c.instructorId })
        }
        const updatedPurchase = await tx.purchase.update({
          where: { id: sessionRequest.purchaseId },
          data: { classesRemaining: { decrement: 3 } },
        })
        if (updatedPurchase.classesRemaining < 0) throw new Error('INSUFFICIENT_CREDITS')
        if (updatedPurchase.classesRemaining === 0) {
          await tx.purchase.update({
            where: { id: sessionRequest.purchaseId },
            data: { status: 'DEPLETED' },
          })
        }
        const updatedRequest = await tx.privateSessionRequest.update({
          where: { id: requestId },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            confirmedBy: session.user.id,
            adminNotes: data.adminNotes?.trim() || null,
          },
        })
        return { created, updatedRequest }
      })

      const instructorById = new Map(instructors.map((i) => [i.id, i.name]))
      sendEmail({
        to: sessionRequest.user.email,
        subject: 'Tus sesiones privadas están confirmadas',
        html: buildPrivateSessionConfirmationEmail({
          userName: sessionRequest.user.name || null,
          sessions: result.created.map((c) => ({
            disciplineName: discipline.name,
            instructorName: instructorById.get(c.instructorId) || '',
            dateTime: formatDateTimeFull(c.dateTime),
            duration: c.duration,
          })),
        }),
      }).catch((err) => console.error('[PRIVATE_SESSIONS] Confirmation email failed:', err))

      console.log('[PRIVATE_SESSIONS] Request confirmed (3 sesiones):', {
        requestId,
        classIds: result.created.map((c) => c.id),
        adminId: session.user.id,
      })

      return NextResponse.json({
        request: result.updatedRequest,
        classes: result.created,
      })
```

- [ ] **Step 5: Tipos/imports**

Asegurar que el archivo importa `buildPrivateSessionConfirmationEmail` con el nuevo shape (ya lo hace) y no quedó código muerto del schema viejo. Quitar `patchSchema` no usado.

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/private-sessions/\[id\]/route.ts
git commit -m "feat(api): admin confirm crea 3 Class+Reservation atómicamente"
```

---

## Task 7: GET /api/admin/private-sessions — incluir confirmedClasses[]

**Files:**
- Modify: `src/app/api/admin/private-sessions/route.ts`

- [ ] **Step 1: Cambiar el `include` del findMany**

Reemplazar el bloque `include` (líneas ~33-46):
```ts
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      purchase: {
        include: { package: { select: { name: true, price: true } } },
      },
      preferredDiscipline: { select: { id: true, name: true, slug: true } },
      preferredInstructor: { select: { id: true, name: true } },
      confirmedClasses: {
        include: {
          discipline: { select: { name: true } },
          instructor: { select: { name: true } },
        },
        orderBy: { dateTime: 'asc' },
      },
    },
```

(Reemplaza la entrada `confirmedClass:` por `confirmedClasses:` — array.)

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```
Expected: sin errores. (Si la UI rompe, queda capturado en Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/private-sessions/route.ts
git commit -m "feat(api): admin list incluye confirmedClasses[]"
```

---

## Task 8: Admin UI — modal 3 filas, listado confirmedClasses[]

**Files:**
- Modify: `src/app/admin/sesiones-privadas/page.tsx`

- [ ] **Step 1: Actualizar el tipo `RequestItem`**

Reemplazar el campo `confirmedClass` por:
```ts
  confirmedClasses: {
    id: string
    dateTime: string
    duration: number
    discipline: { name: string }
    instructor: { name: string }
  }[]
```

- [ ] **Step 2: Renderizar las 3 fechas confirmadas en el listado**

Reemplazar el bloque actual (líneas ~265-276) que muestra `r.confirmedClass`:
```tsx
                    {r.status === 'CONFIRMED' && r.confirmedClasses.length > 0 && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm">
                        <p className="font-medium text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {r.confirmedClasses.length === 1 ? 'Confirmada' : `${r.confirmedClasses.length} sesiones confirmadas`}
                        </p>
                        <ul className="text-emerald-800 mt-1 text-xs space-y-0.5 list-disc list-inside">
                          {r.confirmedClasses.map((c) => (
                            <li key={c.id}>
                              {formatDateTime(c.dateTime)} · {c.instructor.name} · {c.discipline.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
```

- [ ] **Step 3: Detectar legacy vs nuevo en `ConfirmModal`**

Dentro de `ConfirmModal`, agregar:
```tsx
  const isLegacy = request.preferredSlot2 === null || request.preferredSlot3 === null
```

Si `isLegacy`, mantener el JSX del modal actual sin cambios.

Si NO es legacy, renderizar el nuevo bloque (ver Step 4). Hacer un branching de top-level dentro del `return`.

- [ ] **Step 4: Modal nuevo con 3 filas editables**

Estado inicial para el flujo nuevo:
```tsx
  const [disciplineId, setDisciplineId] = React.useState(request.preferredDiscipline.id)
  const [duration, setDuration] = React.useState(60)
  const [adminNotes, setAdminNotes] = React.useState('')
  const [sessions, setSessions] = React.useState(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    return [
      { dateTime: fmt(request.preferredSlot1), instructorId: request.preferredInstructor?.id || '' },
      { dateTime: fmt(request.preferredSlot2!), instructorId: request.preferredInstructor?.id || '' },
      { dateTime: fmt(request.preferredSlot3!), instructorId: request.preferredInstructor?.id || '' },
    ]
  })
```

Handler de submit:
```tsx
  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault()
    if (!disciplineId || sessions.some((s) => !s.dateTime || !s.instructorId)) return
    const isos = sessions.map((s) => new Date(s.dateTime).toISOString())
    if (new Set(isos).size !== 3) {
      alert('Las 3 fechas deben ser distintas')
      return
    }
    setIsSubmitting(true)
    await onConfirm({
      action: 'confirm',
      disciplineId,
      adminNotes: adminNotes.trim() || null,
      sessions: sessions.map((s, i) => ({
        dateTime: isos[i],
        instructorId: s.instructorId,
        duration,
      })),
    })
    setIsSubmitting(false)
  }
```

JSX nuevo (reemplaza el `<form>` cuando `!isLegacy`):
```tsx
        <form onSubmit={handleSubmitNew} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Disciplina <span className="text-red-500">*</span>
            </label>
            <select
              value={disciplineId}
              onChange={(e) => setDisciplineId(e.target.value)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {sessions.map((s, i) => (
            <div key={i} className="p-3 bg-beige/30 rounded-lg space-y-2">
              <p className="text-sm font-medium text-foreground">Sesión {i + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={s.dateTime}
                  onChange={(e) =>
                    setSessions((prev) => prev.map((p, idx) => (idx === i ? { ...p, dateTime: e.target.value } : p)))
                  }
                  className="px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                />
                <select
                  value={s.instructorId}
                  onChange={(e) =>
                    setSessions((prev) => prev.map((p, idx) => (idx === i ? { ...p, instructorId: e.target.value } : p)))
                  }
                  className="px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                >
                  <option value="">Instructor…</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Duración (minutos, aplica a las 3)
            </label>
            <input
              type="number"
              min={15}
              max={180}
              step={15}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notas internas <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              Confirmar 3 sesiones
            </Button>
          </div>
        </form>
```

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/sesiones-privadas/page.tsx
git commit -m "feat(admin-ui): modal 3 sesiones + listado de confirmadas"
```

---

## Task 9: User form — 3 slots requeridos + copy nuevo

**Files:**
- Modify: `src/app/(dashboard)/perfil/sesion-privada/page.tsx:39-41, 155-170, 416-460`

- [ ] **Step 1: Endurecer validación cliente del submit**

Localizar el handler (alrededor de líneas 145-170). Antes de armar el body de fetch:
```ts
    if (!slot1 || !slot2 || !slot3) {
      setError('Debes elegir las 3 fechas y horas para tus 3 sesiones')
      return
    }
    if (new Set([slot1, slot2, slot3]).size !== 3) {
      setError('Las 3 fechas deben ser distintas')
      return
    }
```

Y cambiar el body para no enviar null:
```ts
        preferredSlot1: new Date(slot1).toISOString(),
        preferredSlot2: new Date(slot2).toISOString(),
        preferredSlot3: new Date(slot3).toISOString(),
```

- [ ] **Step 2: Cambiar la sección de slots en el JSX**

Reemplazar líneas 416-460:
```tsx
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  Tus 3 sesiones
                </label>
                <p className="text-xs text-gray-500 -mt-2">
                  Estas serán las fechas y horas reales de tus 3 sesiones privadas. La admin las revisa y confirma.
                </p>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot1}
                    onChange={(e) => setSlot1(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 2 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot2}
                    onChange={(e) => setSlot2(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Sesión 3 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={slot3}
                    onChange={(e) => setSlot3(e.target.value)}
                    min={minDateTime}
                    className="w-full px-3 py-2 border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/perfil/sesion-privada/page.tsx"
git commit -m "feat(form): 3 slots requeridos para Private Flow"
```

---

## Task 10: Smoke test manual end-to-end

**Files:** ninguno.

- [ ] **Step 1: Levantar dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verificar paquete Private Flow visible como 3 clases**

Abrir `http://localhost:3000/paquetes` (o donde se listen). Confirmar que Private Flow aparece como "3 clases", precio $45.

- [ ] **Step 3: Comprar/asignar Private Flow a una usuaria de prueba**

Como admin (o vía `scripts/`), asegurarse de que existe un Purchase ACTIVE con `classesRemaining=3` de paquete `isPrivate=true` para la usuaria de prueba.

- [ ] **Step 4: Solicitar sesión privada (lado usuaria)**

Login como usuaria. Ir a `/perfil/sesion-privada`. Elegir disciplina, instructor preferido y 3 fechas distintas a futuro. Enviar.

Expected:
- `POST /api/private-sessions` → 201.
- Correo llega a `contact@wellneststudio.net` mostrando "Sesión 1/2/3" y los 3 horarios.
- En `/perfil/sesion-privada` aparece la solicitud como PENDING.

- [ ] **Step 5: Validar el endurecimiento del form**

Intentar enviar con 2 slots iguales → error `"Las 3 fechas deben ser distintas"`.

- [ ] **Step 6: Confirmar como admin**

Login como admin (Adriana Bidegain). Ir a `/admin/sesiones-privadas`. Abrir la solicitud, en el modal nuevo editar la `Sesión 2` a otra fecha/hora válida, dejar el resto. Confirmar.

Expected:
- 3 nuevas `Class` en BD (`isPrivate=true`, `privateSessionRequestId=req.id`, `maxCapacity=1`).
- 3 `Reservation` con `status=CONFIRMED`.
- `Purchase.classesRemaining=0` y `status='DEPLETED'`.
- `PrivateSessionRequest.status='CONFIRMED'`, `confirmedAt`, `confirmedBy` set.
- Correo de confirmación a la usuaria lista las 3 sesiones (con la fecha editada por la admin).

- [ ] **Step 7: Validar rama legacy intacta**

Crear (o ubicar) un `PrivateSessionRequest` con `preferredSlot2=null` y `preferredSlot3=null` (datos previos). Confirmarlo desde el admin UI: debería usar el modal viejo (1 fecha) y crear 1 Class + 1 Reservation decrementando 1.

- [ ] **Step 8: Vista usuaria post-confirmación**

Como la usuaria, ir a `/perfil/reservas` y verificar que aparecen las 3 reservas (o la 1 reserva en caso legacy).

- [ ] **Step 9: Commit final / cleanup**

Si hubo ajustes durante el smoke test, commitearlos. Si todo OK:
```bash
git status  # debería estar limpio o sólo con los commits hechos
```

---

## Self-Review

**Spec coverage:**
- Cambio 1 (admin email único) → Task 5 Step 4 ✓
- Schema 1-a-N + drop @unique → Task 1 ✓
- Migración compras vigentes → Task 2 ✓
- Package seed → Task 3 ✓
- Templates email → Task 4 (TDD) ✓
- POST validación 3 slots + classesRemaining≥3 → Task 5 Steps 1-3 ✓
- PATCH admin con bifurcación legacy/nuevo → Task 6 ✓
- GET admin con confirmedClasses[] → Task 7 ✓
- Admin UI modal 3 filas + listado → Task 8 ✓
- Form usuaria 3 slots req → Task 9 ✓
- Smoke test → Task 10 ✓

**Placeholder scan:** ninguno. Todos los steps con código tienen el código completo. Las elipsis en Task 6 Step 2 (`// ... existing reject logic ...`) son referencias al código que YA está en el archivo (reutiliza la lógica de reject sin reescribirla); Step 3 explícitamente dice "mantener la rama legacy idéntica".

**Type consistency:**
- `confirmedClasses` (plural) es consistente entre schema (Task 1), GET endpoint (Task 7) y UI (Task 8).
- `sessions[]` payload es consistente entre PATCH (Task 6) y Admin UI submit (Task 8).
- `PrivateSessionConfirmationData.sessions[]` es consistente entre emailService (Task 4) y consumer en `/admin/private-sessions/[id]` (Task 6 Step 4 nuevo + Step 3 legacy con array de 1).
- `Class.privateSessionRequestId` es consistente entre schema (Task 1) y inserción en transacción (Task 6).

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-05-15-private-flow-3-sessions-and-admin-emails.md`. Dos opciones para ejecutar:

**1. Subagent-Driven (recomendado)** — yo despacho un subagent fresco por task, reviso entre tasks, iteración rápida.

**2. Inline Execution** — ejecutamos los tasks en esta misma sesión con executing-plans, batch con checkpoints.

¿Cuál preferís?
