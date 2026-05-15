# Private Flow → 3 sesiones reales + Notificaciones admin sólo a Adriana López

**Fecha:** 2026-05-15
**Estado:** Aprobado tras brainstorming (pendiente lectura final del usuario)

## Objetivo

Dos cambios independientes en el flujo de sesiones privadas:

1. **Notificaciones admin:** los correos de "nueva solicitud de sesión privada" que hoy se envían a todos los usuarios con `role=ADMIN` pasan a enviarse únicamente a Adriana López (`contact@wellneststudio.net`).
2. **Private Flow = 3 sesiones reales:** el paquete Private Flow pasa de 1 a 3 sesiones por compra. Las 3 fechas/horas que la usuaria elige al solicitar dejan de ser "preferencias alternativas" y se convierten en las 3 sesiones reales. Cuando la admin (Adriana Bidegain) aprueba la solicitud, se generan 3 `Class` + 3 `Reservation` en esas 3 fechas atómicamente.

## Contexto actual

- `Package.isPrivate=true` (Private Flow) hoy tiene `classCount=1`, precio $45, 30 días de vigencia.
- `PrivateSessionRequest` guarda `preferredSlot1` (requerido), `preferredSlot2`/`preferredSlot3` (opcionales) y un `confirmedClassId String? @unique` (1-a-1 con la `Class` confirmada).
- Al confirmar, la admin elige UNA fecha en `src/app/admin/sesiones-privadas/page.tsx` y `PATCH /api/admin/private-sessions/[id]` crea 1 `Class`, 1 `Reservation`, decrementa `classesRemaining` en 1.
- La notificación admin (`notifyAdminsOfNewRequest` en `src/app/api/private-sessions/route.ts:191`) hoy emite a `process.env.ADMIN_NOTIFICATION_EMAIL` si está set, sino a todos los `role=ADMIN`. Es el único correo "a todos los admins" que existe en el sistema.

## Cambio 1 — Notificaciones admin sólo a Adriana López

### Archivos
- `src/app/api/private-sessions/route.ts` (función `notifyAdminsOfNewRequest`).

### Implementación
Reemplazar la lookup dinámica por una constante con override por env var:

```ts
const ADMIN_NOTIFICATION_EMAIL = 'contact@wellneststudio.net'
// ...
const recipients = [process.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_NOTIFICATION_EMAIL]
```

Eliminar la rama que consulta `prisma.user.findMany({ where: { role: 'ADMIN' } })`. El `for (const to of recipients)` queda igual (siempre un solo destinatario, pero respeta la forma del loop).

### Alcance explícito
Sólo este flujo. No tocar otros correos del sistema (recuperar contraseña, factura, recordatorios, etc., ninguno está dirigido a múltiples admins).

## Cambio 2 — Private Flow = 3 sesiones reales

### Modelo de datos

**Schema (`prisma/schema.prisma`):**

- `PrivateSessionRequest`:
  - `confirmedClassId String?` se conserva nullable como tag histórico de la clase confirmada en flujo legacy (1 sesión). Se quita la restricción `@unique` y se quita la relación inversa `confirmedClass Class? @relation`.
  - `confirmedAt`, `confirmedBy` se conservan tal cual.
  - `preferredSlot2` y `preferredSlot3` se mantienen `DateTime?` (nullable) en schema por compat con requests legacy; el validador del API endurece a requerido para nuevos requests.
  - Agregar relación inversa `confirmedClasses Class[]` (lado opuesto del nuevo FK descrito abajo).
- `Class`:
  - Agregar `privateSessionRequestId String?` con `@index` y relación `privateSessionRequest PrivateSessionRequest? @relation(fields: [privateSessionRequestId], references: [id], onDelete: SetNull)`.

**Migración Prisma:**
```sql
ALTER TABLE "PrivateSessionRequest" DROP CONSTRAINT IF EXISTS "PrivateSessionRequest_confirmedClassId_fkey";
ALTER TABLE "PrivateSessionRequest" DROP CONSTRAINT IF EXISTS "PrivateSessionRequest_confirmedClassId_key";
-- mantenemos la columna confirmedClassId nullable como referencia histórica (sin FK, sin unique)

ALTER TABLE "Class" ADD COLUMN "privateSessionRequestId" TEXT;
ALTER TABLE "Class" ADD CONSTRAINT "Class_privateSessionRequestId_fkey"
  FOREIGN KEY ("privateSessionRequestId") REFERENCES "PrivateSessionRequest"(id) ON DELETE SET NULL;
CREATE INDEX "Class_privateSessionRequestId_idx" ON "Class"("privateSessionRequestId");
```

(Decisión: conservar `confirmedClassId` nullable como dato histórico, sin FK ni unique. Las clases del flujo nuevo se asocian al request vía el FK `Class.privateSessionRequestId` y se consultan con la relación `confirmedClasses Class[]`.)

### Package Private Flow

Actualizar el registro Private Flow en BD:
- `classCount: 3`
- Texto en `subtitle`, `shortDescription`, `fullDescription`, `bulletsTop`, `bulletsBottom`: reflejar "3 sesiones privadas 1:1".
- Mantener `price=45`, `validityDays=30`, `isPrivate=true`.

Editar `scripts/seed-new-packages-2026-04.ts` (el seed canónico de Private Flow) para que un re-seed produzca la nueva config.

### Migración de compras vigentes

`scripts/migrate-private-flow-to-3-sessions.ts`:

```ts
// Lista candidatos: Purchase ACTIVE, packageId isPrivate, classesRemaining = 1,
// y SIN PrivateSessionRequest en estado PENDING o CONFIRMED.
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
})
await prisma.purchase.updateMany({
  where: { id: { in: candidates.map((c) => c.id) } },
  data: { classesRemaining: 3 },
})
console.log({ migrated: candidates.length })
```

Loguea también las compras omitidas (con solicitudes activas) para revisión manual.

### Form de la usuaria

Archivo: `src/app/(dashboard)/perfil/sesion-privada/page.tsx`, líneas 416–460.

- Título de la sección: "Tus 3 sesiones" (en vez de "Ventanas de horario preferidas").
- Texto auxiliar: "Estas serán las fechas y horas reales de tus 3 sesiones. La admin las revisa y confirma."
- Labels de inputs: "Sesión 1", "Sesión 2", "Sesión 3".
- Los 3 inputs `datetime-local` pasan a `required`.
- Quitar "(opcional)" de slot 2 y 3.
- Validación cliente antes de POST:
  - Los 3 valores no vacíos.
  - Los 3 valores son fechas distintas (no permitir la misma fecha+hora dos veces).
  - Los 3 valores son a futuro (ya cubierto por `min={minDateTime}`).
- Mensaje de error específico si la validación falla.

### `POST /api/private-sessions`

Archivo: `src/app/api/private-sessions/route.ts`.

- `createRequestSchema`:
  - `preferredSlot2: z.string().datetime({ message: '...' })` (requerido, no opcional).
  - `preferredSlot3: z.string().datetime({ message: '...' })` (requerido).
  - Cross-field check: las 3 fechas son distintas.
- Validar `purchase.classesRemaining >= 3` (si la compra ya fue parcialmente consumida o es un Private Flow legacy migrado parcialmente, error explícito).
- Mantener el bloqueo de duplicate PENDING/CONFIRMED para la misma compra.
- `notifyAdminsOfNewRequest`: el copy del HTML pasa de "ventanas preferidas" a "3 sesiones agendadas". Actualizar `buildAdminPrivateSessionNotification` en `src/lib/emailService.ts` (los 3 slots se renderizan como "Sesión 1 · …", "Sesión 2 · …", "Sesión 3 · …").

### `PATCH /api/admin/private-sessions/[id]`

Archivo: `src/app/api/admin/private-sessions/[id]/route.ts`.

`confirmSchema` (nuevo formato):
```ts
const sessionSchema = z.object({
  dateTime: z.string().datetime(),
  instructorId: z.string().min(1),
  duration: z.number().int().positive().default(60),
})
const confirmSchema = z.object({
  action: z.literal('confirm'),
  disciplineId: z.string().min(1),
  sessions: z.array(sessionSchema).length(3), // las 3 ediciones de la admin
  adminNotes: z.string().max(2000).optional().nullable(),
})
```

Transacción atómica:
1. Validar `purchase.classesRemaining >= 3` y `purchase.status === 'ACTIVE'`.
2. Crear 3 `Class`:
   - `disciplineId`, `dateTime`, `duration` por sesión.
   - `instructorId` por sesión.
   - `maxCapacity=1`, `currentCount=0`, `isPrivate=true`, `classType='Sesión privada'`, `privateSessionRequestId=req.id`.
3. Decrementar `purchase.classesRemaining` en 3. Si queda 0 → `status='DEPLETED'`.
4. Crear 3 `Reservation` (una por Class) con `status=CONFIRMED`, mismo `purchaseId`.
5. `PrivateSessionRequest.status='CONFIRMED'`, `confirmedAt`, `confirmedBy`, `adminNotes`.
6. Si en cualquier paso `classesRemaining < 0` → throw `INSUFFICIENT_CREDITS`.

`buildPrivateSessionConfirmationEmail` en `src/lib/emailService.ts`:
- Acepta array de 3 sesiones (cada una con dateTime + instructorName + disciplineName + duration).
- Render: "Tu paquete Private Flow está confirmado. Estas son tus 3 sesiones:" + lista.

### Compatibilidad legacy

Hay requests existentes con `preferredSlot2`/`preferredSlot3` nulos (modelo viejo, 1 sesión). Estrategia: el endpoint inspecciona el request en BD antes de validar el body.

```ts
const isLegacy = req.preferredSlot2 === null || req.preferredSlot3 === null

if (data.action === 'reject') { /* rama compartida */ }
else if (isLegacy) {
  // validar body contra confirmSchemaLegacy (= el actual: dateTime + instructorId + disciplineId + duration)
  // ejecutar la transacción vieja: 1 Class + 1 Reservation + decremento 1, set confirmedClassId
} else {
  // validar body contra confirmSchemaNew (= sessions[] + disciplineId + adminNotes)
  // ejecutar la transacción nueva: 3 Class + 3 Reservation + decremento 3
}
```

Definir 2 schemas zod separados (`confirmSchemaLegacy`, `confirmSchemaNew`) y elegir cuál validar en runtime. No usar `discriminatedUnion` porque `action` no discrimina entre los dos confirm shapes — la discriminación es por el estado del request en BD, no por el cuerpo.

### Admin UI

Archivo: `src/app/admin/sesiones-privadas/page.tsx`.

**Listado:**
- Tipo `RequestItem.confirmedClass: Class | null` → `confirmedClasses: Class[]` (cero o varias).
- Badge "Confirmada" lista las 3 fechas confirmadas en lugar de una.
- "Ventanas preferidas" → "3 sesiones solicitadas" cuando la request es de modelo nuevo.

**`ConfirmModal`:**
- Detectar si la request es legacy (`slot2`/`slot3` null) → modal viejo intacto.
- Si es nueva:
  - 1 select disciplina (compartida).
  - 3 filas, cada una con:
    - `datetime-local` precargado con `preferredSlotN`, editable.
    - select instructor (puede ser distinto por sesión; se precarga con `preferredInstructor` si existe).
  - 1 input duración (compartida).
  - 1 textarea notas internas.
- Submit envía `{ action, disciplineId, adminNotes, sessions: [{dateTime, instructorId, duration}, x3] }`.

**`GET /api/admin/private-sessions`:**
- Incluir `confirmedClasses` (array) además de `confirmedClass` legacy. Actualizar el tipo del JSON response.

### Tests / verificación manual

Smoke test al terminar:
1. Migración: correr el script en dry-run (logs), luego en vivo. Verificar conteos.
2. Form usuaria: cargar `/perfil/sesion-privada`, validar los 3 inputs requeridos, enviar request con 3 fechas distintas, ver que el correo a `contact@wellneststudio.net` llega con las 3 sesiones.
3. Admin: en `/admin/sesiones-privadas` confirmar la request, editar 1 de las 3 fechas, confirmar → ver que se crean 3 Classes con `isPrivate=true`, 3 Reservations CONFIRMED, `purchase.classesRemaining=0`, status=DEPLETED.
4. Correo a la usuaria lista las 3 fechas confirmadas.
5. Legacy: tomar una request con slot2/slot3 null y confirmar con el modal viejo → 1 Class, 1 Reservation, decremento 1.

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Drop `confirmedClassId`, add `Class.privateSessionRequestId` + relación |
| `prisma/migrations/<timestamp>_private_flow_3_sessions/migration.sql` | DDL arriba |
| `scripts/migrate-private-flow-to-3-sessions.ts` | Script de migración de compras vigentes (nuevo) |
| `scripts/seed-new-packages-2026-04.ts` | Private Flow → 3 sesiones |
| `src/app/api/private-sessions/route.ts` | Email destinatario fijo + slot2/3 required + 3 sesiones plurales en notif |
| `src/app/api/admin/private-sessions/[id]/route.ts` | Nuevo schema + transacción que crea 3 Class/Reservation; rama legacy intacta |
| `src/app/api/admin/private-sessions/route.ts` | Incluir `confirmedClasses` en response |
| `src/app/admin/sesiones-privadas/page.tsx` | Modal nuevo con 3 filas; listado muestra `confirmedClasses[]` |
| `src/app/(dashboard)/perfil/sesion-privada/page.tsx` | 3 slots requeridos, copy nuevo, validación distintos |
| `src/lib/emailService.ts` | `buildAdminPrivateSessionNotification` y `buildPrivateSessionConfirmationEmail` aceptan/renderean 3 sesiones |

## Orden de implementación sugerido

1. Schema + migración Prisma + script de migración de compras.
2. Backend: `POST /api/private-sessions` (validación) + `notifyAdminsOfNewRequest` (correo a Adriana López).
3. Backend: `PATCH /api/admin/private-sessions/[id]` con doble rama (legacy + nueva).
4. `emailService` templates.
5. UI usuaria.
6. UI admin.
7. Seed update + smoke test manual.

## Riesgos y mitigaciones

- **Migración rompe compras con solicitudes activas:** mitigado al filtrar `NOT { privateSessionRequests: { some: { status: { in: ['PENDING','CONFIRMED'] } } } }`. Se omiten y se loguean.
- **Requests legacy en vuelo:** detección por `slot2/slot3 null` permite mantener el flujo viejo sin tocar datos.
- **Schemas duales en `PATCH /api/admin/private-sessions/[id]`:** dos formatos de body conviven en producción durante la transición. Mitigado eligiendo el schema según el estado del request en BD (no según `action`), con test manual de ambas ramas antes de mergear.
