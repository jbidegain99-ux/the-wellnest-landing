# Lista de espera: UI interactiva y notificación por email

**Fecha:** 2026-05-01
**Autor:** Jose Bidegain (con Claude)
**Estado:** Aprobado para implementación

## Contexto

Usuarias del sitio reportan que la funcionalidad de lista de espera no funciona: las clases llenas aparecen "grayed out" sin posibilidad de interacción. Una auditoría confirma el bug en `src/app/(dashboard)/reservar/page.tsx`:

- Línea 166 / 768: `isDisabled = isFull || ...` — incluye `isFull` en la condición que deshabilita el botón.
- Línea 172 / 774: `disabled={isDisabled}` — el botón queda inerte.
- Línea 489-498: `handleSelectClass` retorna sin abrir ningún modal cuando la clase está llena.

A pesar de esto, la infraestructura de backend para lista de espera ya está completa:

- Modelo `Waitlist` en Prisma con unicidad `(userId, classId)` y `position` ordenado.
- `POST/GET/DELETE /api/waitlist` funcionales.
- Auto-asignación implementada en `src/app/api/reservations/cancel/route.ts` (líneas 204-273): al cancelar, asigna automáticamente a la primera persona con paquete activo y descuenta una clase.
- Página `/perfil/espera` que muestra las entradas activas.

**Lo que falta:**

1. UI en `/reservar` para que la usuaria pueda unirse y gestionar la lista de espera.
2. Email transaccional cuando se asigna automáticamente un cupo liberado.
3. Aplicar la misma auto-asignación + email en el endpoint de cancelación de admin (`/api/admin/attendance/cancel-reservation`), que hoy no la dispara.
4. Actualizar el aviso informativo en `/perfil/espera` que dice "actualmente no enviamos notificaciones por correo".

## Decisiones de diseño

### Comportamiento sin paquete activo

Si una usuaria intenta unirse a la lista de espera sin paquete activo con clases disponibles, **se permite** (consistente con el backend actual, que la salta sin paquete) **pero el modal le advierte explícitamente** que no será asignada cuando se libere un cupo y la invita a comprar un paquete antes (`opción C`).

### Comportamiento si ya está en la lista de espera

El botón de la clase muestra un estado distinto "En lista #N" en color ámbar oscuro. Al tocarlo abre un modal informativo con su posición y la opción de salir de la lista directamente desde ahí (`opción A`).

### Cancelación administrativa

La auto-asignación + email se replica también en `/api/admin/attendance/cancel-reservation` para que el comportamiento sea consistente, sin importar quién libere el cupo.

## Especificación técnica

### 1. UI en `src/app/(dashboard)/reservar/page.tsx`

**Tres estados visuales nuevos:**

| Estado | Badge | Color | Tappable |
|---|---|---|---|
| Disponible | "N cupos" | verde (`bg-green-50 text-green-700`) | sí |
| Llena, NO en lista | "Lleno" | ámbar (`bg-amber-50 text-amber-700`) | sí |
| Llena, EN lista | "En lista #N" | ámbar oscuro (`bg-amber-100 text-amber-900`) | sí |
| Reservada | "Reservado" + ✓ | primario | no |
| Pasada | "Finalizada" | gris | no |

**Cambios en el componente:**

1. Quitar `isFull` de `isDisabled` en ambas vistas (mobile línea 166, desktop línea 768).
2. Agregar nuevo estado:
   ```ts
   const [waitlistEntries, setWaitlistEntries] = React.useState<
     Map<string, { id: string; position: number }>
   >(new Map())
   ```
3. Agregar `fetchWaitlist` (paralela a `fetchUserReservations`) que consume `GET /api/waitlist` y carga el Map.
4. Llamarla en el `useEffect` de inicialización y en el `visibilitychange` listener.
5. Pasar `waitlistEntries` al `MobileDaySection` por props.
6. Modificar `handleSelectClass` para abrir el modal correspondiente según el estado de la clase.

**Modal — nuevos estados:**

Extender `ModalState` a:
```ts
type ModalState =
  | 'closed'
  | 'confirm'             // existente: confirmar reserva
  | 'success'             // existente: reserva exitosa
  | 'error'               // existente: error
  | 'waitlist-confirm'    // nuevo: confirmar unirse a lista
  | 'waitlist-success'    // nuevo: éxito al unirse
  | 'waitlist-info'       // nuevo: ya en lista, ver/salir
```

**Modal `waitlist-confirm`:**

- Card de la clase (mismo estilo que `confirm`).
- Mensaje: "Esta clase está llena. Únete a la lista de espera y te asignaremos automáticamente el primer cupo que se libere."
- Si NO tiene paquete activo o `classesRemaining === 0`: bloque de advertencia ámbar con texto "Sin paquete activo con clases disponibles, NO podrás ser asignada cuando se libere un cupo. Compra un paquete antes para no perder tu turno." + link a `/paquetes`.
- Botones: `Cancelar` / `Unirme a la lista`.
- Al confirmar: `POST /api/waitlist { classId }`. Si OK → `waitlist-success`. Si error → `error`.

**Modal `waitlist-info`:**

- Card de la clase.
- Mensaje: "Estás en la lista de espera." + "Posición #N de M".
- Texto: "Te enviaremos un correo si se libera un cupo y eres asignada."
- Botones: `Cerrar` / `Salir de la lista`.
- Al salir: `DELETE /api/waitlist { waitlistId }`. Si OK → cerrar modal y refrescar.

**Modal `waitlist-success`:**

- Mensaje: "¡En lista de espera!" + "Te has unido en posición #N. Te avisaremos por correo si se libera un cupo."
- Botón: `Entendido`.

Al cerrar cualquiera de los modales de waitlist, refrescar `waitlistEntries` para que el badge se actualice en la grilla.

### 2. `src/app/api/waitlist/route.ts` — endurecimiento de POST

Después de cargar `classInfo`, agregar dos validaciones:

```ts
const classInfo = await prisma.class.findUnique({
  where: { id: classId },
  include: {
    discipline: true,
    _count: { select: { reservations: { where: { status: 'CONFIRMED' } } } },
  },
})

if (!classInfo) return 404

if (new Date(classInfo.dateTime) < new Date()) {
  return NextResponse.json(
    { error: 'No puedes unirte a la lista de espera de una clase que ya pasó.' },
    { status: 400 }
  )
}

if (classInfo._count.reservations < classInfo.maxCapacity) {
  return NextResponse.json(
    { error: 'Esta clase aún tiene cupos disponibles. Reserva directamente.' },
    { status: 400 }
  )
}
```

No se requiere ningún otro cambio en el endpoint. La unicidad `(userId, classId)` y el cálculo de `position` ya funcionan.

### 3. `src/lib/emailService.ts` — nuevo template

```ts
export interface WaitlistAssignedEmailData {
  userName: string | null
  disciplineName: string
  instructorName: string
  dateTime: string         // formateado en español, ej: "Miércoles 7 de mayo, 6:30 PM"
  duration: number
  packageName: string
  classesRemaining: number
  profileUrl: string
}

export function buildWaitlistAssignedEmail(data: WaitlistAssignedEmailData): string
```

**Estilo:** idéntico a `buildReservationConfirmationEmail` (fondo `#F5F0EB`, card blanca 480px, botón verde `#86A889`).

**Subject:** `¡Se liberó un cupo! Tu reserva está confirmada — Wellnest`

**Estructura del body:**

- H1: `¡Se liberó un cupo!`
- Subtítulo: `Wellnest`
- Saludo: `Hola ${userName}` (o solo `Hola` si no hay nombre)
- Mensaje principal: "Estabas en la lista de espera y se liberó un cupo. Hemos confirmado tu reserva automáticamente y descontado 1 clase de tu paquete."
- Card de detalles (mismo estilo `#F9FAFB` con bordes que los otros emails): Clase, Instructor, Fecha y hora, Duración, Ubicación: Wellnest Studio.
- Card de paquete (verde claro `#F0F5F1`): "Se descontó 1 clase de tu paquete **{packageName}**. Te quedan **{classesRemaining}** clases disponibles."
- Botón verde: "Ver mis reservas" → `${NEXTAUTH_URL}/perfil/reservas`.
- Nota final: "Si no puedes asistir, recuerda cancelar con al menos 4 horas de anticipación desde tu perfil para que la clase regrese a tu paquete."
- Footer estándar: `Wellnest © 2026 • contact@wellneststudio.net`.

### 4. Disparar email en `src/app/api/reservations/cancel/route.ts`

Tras el `prisma.$transaction` que crea la reserva del usuario en lista de espera (línea 260), agregar un bloque no-bloqueante:

```ts
try {
  const purchaseWithPkg = await prisma.purchase.findUnique({
    where: { id: purchaseToUse.id },
    include: { package: true },
  })

  await sendEmail({
    to: firstInWaitlist.user.email,
    subject: '¡Se liberó un cupo! Tu reserva está confirmada — Wellnest',
    html: buildWaitlistAssignedEmail({
      userName: firstInWaitlist.user.name,
      disciplineName: reservation.class.discipline.name,
      instructorName: reservation.class.instructor.name,
      dateTime: formatDateTimeES(reservation.class.dateTime),
      duration: reservation.class.duration,
      packageName: purchaseWithPkg!.package.name,
      classesRemaining: purchaseWithPkg!.classesRemaining,
      profileUrl: `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/perfil/reservas`,
    }),
  })
} catch (emailErr) {
  console.error('[CANCEL API] Failed to send waitlist email (non-blocking):', emailErr)
}
```

`formatDateTimeES` se reutiliza de `formatDateTimeShort` ya existente en `emailService.ts`, exportándolo si es necesario.

### 5. Replicar en `src/app/api/admin/attendance/cancel-reservation/route.ts`

Hoy este endpoint no dispara la auto-asignación de lista de espera. Replicar el mismo bloque (líneas 204-273 del endpoint usuario) ajustado al contexto admin:

1. Buscar `firstInWaitlist` con sus `purchases ACTIVE` con `classesRemaining > 0`.
2. Si existe, ejecutar la transacción que crea la reserva, decrementa el paquete, elimina la entrada y reordena las posiciones.
3. Disparar el email no-bloqueante con el mismo template.

Mantener el resto del flujo del admin sin cambios.

### 6. `src/app/(dashboard)/perfil/espera/page.tsx` — actualizar nota

Reemplazar el bloque de aviso (líneas 178-188) por una sola nota positiva:

```tsx
<div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600">
  <p>
    <strong>Importante:</strong> Cuando alguien cancela su reserva, el primer lugar
    de la lista de espera es asignado automáticamente si tiene clases disponibles
    en su paquete. Te enviaremos un correo electrónico avisándote cuando esto ocurra.
    El cupo se descontará de tu paquete activo más próximo a vencer.
  </p>
</div>
```

## Pruebas manuales

1. Llenar una clase con dos cuentas, intentar reservar con una tercera → debe abrirse el modal `waitlist-confirm` con el mensaje correcto.
2. Confirmar unión → badge "En lista #1" en la grilla y entrada en `/perfil/espera`.
3. Cancelar la reserva de una de las dos primeras cuentas (flujo usuario) → la tercera debe quedar con reserva confirmada automáticamente y debe llegar el email con el formato correcto.
4. Repetir paso 3 pero cancelando desde admin (`/admin/asistencias/[classId]`) → mismo resultado.
5. Tocar una clase donde ya estoy en lista → modal `waitlist-info` con opción de salir.
6. Salir de la lista desde el modal → badge vuelve a "Lleno", entrada desaparece de `/perfil/espera`.
7. Intentar unirse sin paquete activo → ver bloque de advertencia ámbar y link a `/paquetes`.
8. Intentar `POST /api/waitlist` directo a una clase con cupos → 400 con mensaje correcto.
9. Intentar `POST /api/waitlist` directo a una clase pasada → 400 con mensaje correcto.

## Riesgos y trade-offs

- **Email no-bloqueante:** si Microsoft Graph falla, la asignación ya ocurrió en BD. Aceptable porque el sistema actual ya funciona sin email; el email es valor agregado y no debe bloquear el flujo crítico.
- **Concurrencia en admin cancel:** se mantiene el mismo patrón de transacción que el endpoint usuario. La race condition existente entre múltiples cancelaciones simultáneas en la misma clase no empeora con este cambio.
- **Position drift:** si entre que la usuaria abre el modal `waitlist-info` y le da "Salir" se libera un cupo y ella es asignada, recibirá un error 404 al intentar borrar la entrada. El frontend manejará el error refrescando el estado.

## Archivos afectados

1. `src/app/(dashboard)/reservar/page.tsx` — UI completa
2. `src/app/api/waitlist/route.ts` — validaciones POST
3. `src/lib/emailService.ts` — nuevo template + export de helper
4. `src/app/api/reservations/cancel/route.ts` — disparar email
5. `src/app/api/admin/attendance/cancel-reservation/route.ts` — auto-asignación + email
6. `src/app/(dashboard)/perfil/espera/page.tsx` — nota informativa

## Fuera de alcance

- Email de confirmación al unirse a la lista de espera (la usuaria ya recibe feedback inmediato en la UI).
- Notificaciones push o badges en el dashboard.
- Refactor del modelo `Waitlist` para guardar `notifiedAt` o estado.
- Cambios al schema de Prisma.
