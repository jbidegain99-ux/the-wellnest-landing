# Invitado que ocupa 2 cupos y cuesta 2 clases (auto-asignado)

**Fecha:** 2026-05-25
**Estado:** Aprobado para planificación

## Problema

Al reservar con invitado, el sistema descuenta **1 sola clase** y crea **1 sola reserva**
(`reservations/route.ts:754-820`, "New model: 1 single reservation … decrement 1 class only").
El invitado queda como acompañante gratis y **no ocupa cupo** en la clase. Además el invitado
debe **confirmar** por email (`/api/invitations/[token]`), flujo que solo cambia `guestStatus`
y nunca afecta créditos ni cupos.

La dueña del estudio quiere otro modelo (opción B confirmada):
- Traer invitado **cuesta 2 clases** (1 de la titular + 1 del invitado).
- El invitado **ocupa un 2º cupo** físico en la clase (cuenta en el aforo).
- El invitado se **asigna automáticamente** (sin confirmación por email).
- **No se envía correo** al invitado.

## Hallazgo clave

El esquema ya soporta el modelo de **dos reservas** por booking:
- `@@unique([userId, classId, isGuestReservation])` permite una reserva del titular
  (`isGuestReservation=false`) y otra del invitado (`isGuestReservation=true`) con el mismo
  `userId` y `classId`.
- El conteo de cupos usa `reservations where status != CANCELLED`
  (`classes/route.ts:88-92` y `reservations/route.ts:183`), que **cuenta ambas reservas
  automáticamente**.

Por lo tanto, la opción B se implementa volviendo al **modelo de dos reservas**, auto-aceptado.
El "modelo de 1 reserva" actual fue una simplificación que rompió el 2º cupo y el 2º cobro.

## Decisiones confirmadas

- Invitado **ocupa 2 cupos** (cuenta en el aforo).
- **No** se envía correo al invitado.
- Se **corrige** la reserva ya hecha por Adriana (79 → 78) al nuevo modelo.

## Diseño

### 1. Reservar con invitado — `POST /api/reservations` (bloque guest ~754-820)

Reemplazar el modelo de 1 reserva por:
- Validar que el paquete sea `isShareable` y `maxShares >= 1` (ya existe).
- Validar **`classesRemaining >= 2`** (hoy valida `>= 1`). Si no, error claro
  ("Necesitas al menos 2 clases para llevar un invitado").
- Validar **2 cupos libres**: si `maxCapacity - reservasNoCanceladas < 2`, rechazar con
  mensaje ("No hay 2 cupos disponibles para vos y tu invitado").
- En una transacción:
  - `purchase.classesRemaining` **decrement: 2** (guardar contra `< 0`).
  - Crear reserva del **titular**: `userId, classId, purchaseId, status=CONFIRMED,
    isGuestReservation=false`, sin campos de invitado.
  - Crear reserva del **invitado**: `userId` (de la titular), `classId, purchaseId,
    status=CONFIRMED, isGuestReservation=true, guestEmail, guestName,
    guestStatus='ACCEPTED', guestToken=null`.
- **No** llamar a `buildGuestInvitationEmail` ni enviar correo al invitado. (El correo de
  confirmación de la titular, si existe hoy, se mantiene sin cambios.)

### 2. Cupos — automático

Las dos reservas (no canceladas) cuentan en `_count.reservations`, así que el aforo en
`/api/classes` (horarios y reservar) refleja 2 sin tocar más código.

### 3. Cancelación — `POST /api/reservations/cancel`

Al cancelar la reserva del titular:
- Buscar también la reserva del invitado (misma `userId + classId`,
  `isGuestReservation=true`, `status != CANCELLED`).
- Si existe: cancelar **ambas** y devolver **2** clases al paquete.
- Si no existe (reserva normal sin invitado): comportamiento actual (cancelar 1, devolver 1).
- Mantener la reactivación de paquete DEPLETED→ACTIVE y el auto-assign de lista de espera
  existentes.

### 4. UI de reservar — `reservar/page.tsx`

- Texto de descuento: cuando hay invitado, "Se descontarán **2 clases** (1 tuya + 1 invitado)"
  y el cálculo de "clases restantes después" usa 2.
- Deshabilitar el check "Llevar un invitado" (o impedir confirmar) si:
  - el paquete seleccionado tiene `classesRemaining < 2`, o
  - la clase tiene menos de 2 cupos libres (`maxCapacity - currentCount < 2`).
- Actualizar la nota que hoy dice "Se descontará 1 clase … invitado asiste gratis" para
  reflejar 2 clases y que el invitado ocupa un cupo.

### 5. Corrección de datos — reserva existente de Adriana (script único)

La reserva `cmpkmrk8w...` (Mat Pilates 25-may) hoy: 1 reserva con `guestEmail`/`guestName`
sobre la reserva del titular, `guestStatus=PENDING`, paquete en 79.
Migrar al nuevo modelo:
- Crear la reserva del **invitado** (`isGuestReservation=true`, `guestStatus='ACCEPTED'`,
  con el `guestEmail`/`guestName` actuales) para esa misma clase y paquete.
- Limpiar los campos de invitado de la reserva del titular (`guestEmail=null,
  guestName=null, guestStatus=null, guestToken=null`).
- `purchase.classesRemaining` **decrement: 1** (79 → 78).
- Todo en una transacción.

## Fuera de alcance (decidido)

- **Lista de espera al cancelar con invitado:** se liberan 2 cupos pero el auto-assign sigue
  asignando solo a la 1ª persona; el 2º cupo queda libre para cualquiera. No se cambia.
- No se toca el endpoint `/api/invitations/[token]` ni la página `/invitacion/[token]`: quedan
  inertes para invitados nuevos (ya no se crean tokens), pero no se eliminan en este cambio.
- No se cambia el flujo del titular ni el de paquetes no compartibles.

## Verificación

- Reservar con invitado descuenta 2 y crea 2 reservas; el aforo de la clase baja en 2.
- Con `< 2` clases o `< 2` cupos, el sistema impide llevar invitado (server + UI).
- Cancelar una reserva con invitado devuelve 2 y cancela ambas reservas.
- La reserva de Adriana queda con paquete en 78, una reserva de invitado ACCEPTED y la del
  titular sin campos de invitado.
- Las reservas sin invitado siguen descontando 1 y ocupando 1 cupo.
