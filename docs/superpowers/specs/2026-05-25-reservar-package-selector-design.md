# Selector de paquete por clase en `/reservar`

**Fecha:** 2026-05-25
**Estado:** Aprobado para planificación

## Problema

El checkbox "Llevar un invitado" en `/reservar` solo aparece si el paquete activo es
compartible (`reservar/page.tsx:1105`, condición `activePurchase?.package?.isShareable`).
Ese "paquete activo" viene de `GET /api/user/active-purchase`, que hace un `findFirst`
ordenado por `expiresAt: 'asc'` (`active-purchase/route.ts:18-29`) — es decir, elige el
paquete activo que **vence primero**, sin importar cuál quiere usar la persona ni si es
compartible.

Cuando alguien tiene varios paquetes activos a la vez, uno NO compartible que vence antes
"tapa" al Trimestral compartible:

| Usuaria | Paquete auto-elegido (vence antes) | Compartible | Trimestral (vence después) |
|---|---|---|---|
| Adriana Bidegain | Private Flow → 2026-06-10 | no | 2026-08-23 |
| Gabriela G. Lucha | Drop-In → 2026-05-23 | no | 2026-07-14 |

Consecuencias:
1. No aparece el checkbox de invitado aunque la persona sí tiene un paquete compartible.
2. La reserva se descontaría del paquete equivocado (el auto-elegido), no del que la
   persona quiere usar.
3. Para Adriana el paquete auto-elegido es **privado** (`isPrivate`), que el backend
   rechaza para clases grupales (`validatePackageAllowsClass`, `reservations/route.ts:49-56`),
   así que la reserva fallaría de todos modos.

El paquete en sí está bien configurado (`isShareable: true`, `maxShares: 1`). El defecto
está en cómo el cliente elige qué paquete usar.

## Solución

Permitir que la persona **elija con cuál paquete reserva** cuando tiene más de uno válido
para esa clase. El checkbox de invitado y el descuento de la clase se atan al paquete
seleccionado. La compatibilidad (privado / disciplinas) se calcula en el servidor para que
las reglas no se dupliquen en el cliente.

### Decisiones de diseño (confirmadas)

- **Default:** el paquete que vence primero (earliest-expiring) entre los compatibles, para
  no desperdiciar clases por vencer. La persona puede cambiar al compartible para invitar.
- **Paquetes incompatibles:** se ocultan del selector (no se muestran deshabilitados).
- **Header:** refleja el paquete seleccionado (nombre + clases restantes), en sincronía con
  el selector del modal.

## Componentes

### 1. Endpoint nuevo — `GET /api/user/bookable-purchases?classId=<id>`

Devuelve únicamente los paquetes activos válidos para esa clase específica.

- Requiere sesión (igual que los demás endpoints de `/api/user/*`).
- Lee `classId` de query params; si falta o la clase no existe → 400.
- Carga la clase para obtener su `disciplineId`.
- Carga las compras del usuario con `status='ACTIVE'`, `classesRemaining > 0`,
  `expiresAt > now`, incluyendo `package.disciplines`.
- Filtra cada compra con el **mismo predicado de compatibilidad** que usa el POST de
  reservas (excluye `isPrivate`; excluye paquetes cuya lista de disciplinas no cubre la
  disciplina de la clase).
- Responde un arreglo **ordenado por `expiresAt` asc**. Cada item:

  ```ts
  {
    purchaseId: string
    packageId: string
    packageName: string
    classesRemaining: number
    expiresAt: string   // ISO
    isShareable: boolean
    maxShares: number
  }
  ```

- El primer item es el default sugerido.

### 2. Refactor de compatibilidad (reutilización)

Extraer de `validatePackageAllowsClass` (`reservations/route.ts:38`) un predicado puro:

```ts
function isPackageCompatibleWithClass(
  pkg: { isPrivate: boolean; disciplines: { disciplineId: string }[] },
  classDisciplineId: string
): boolean
```

- `validatePackageAllowsClass` sigue produciendo los mensajes de error pero delega la
  decisión a este predicado.
- El endpoint nuevo usa el mismo predicado. Una sola fuente de verdad.

### 3. Cliente — `reservar/page.tsx`

- Nuevo estado a nivel de página:
  - `bookablePurchases: BookablePurchase[]` — paquetes compatibles con la clase del modal.
  - `selectedPurchaseId: string | null` — el paquete elegido (fuente única de verdad).
- Al **abrir el modal de confirmación** de una clase, hace
  `GET /api/user/bookable-purchases?classId=<id>` y llena `bookablePurchases`.
- Selección por defecto:
  - Si hay un `packageId` en la URL y está en la lista → ese.
  - Si el `selectedPurchaseId` actual sigue siendo válido para esta clase → se mantiene.
  - Si no → el primero de la lista (earliest-expiring compatible).
- Render dentro del modal:
  - `length > 1` → selector (lista de radios / dropdown) mostrando por cada opción:
    nombre · clases restantes · vence.
  - `length === 1` → sin selector; muestra el nombre del único paquete.
  - `length === 0` → bloquea confirmar con mensaje claro
    ("No tienes un paquete válido para esta clase").
- **Checkbox de invitado:** su condición pasa a depender del paquete seleccionado
  (`selected?.isShareable`) en lugar de `activePurchase?.package?.isShareable`.
- **Descuento:** al confirmar, el cliente envía siempre `purchaseId = selectedPurchaseId`
  a `POST /api/reservations`, así la clase se descuenta exactamente del paquete mostrado.
- **Header:** muestra el nombre + clases restantes del paquete seleccionado. Cuando la
  persona cambia el paquete en el modal, el header se actualiza.

## Flujo de datos

1. Carga de página: se mantiene `GET /api/user/active-purchase` para el resumen inicial;
   `selectedPurchaseId` arranca con el paquete que vence primero.
2. Usuario abre una clase → modal → fetch `bookable-purchases?classId` → llena lista +
   ajusta default si el seleccionado no es compatible con esa clase.
3. Usuario (opcional) cambia el paquete en el selector → actualiza `selectedPurchaseId` →
   header y checkbox de invitado reaccionan.
4. Usuario (opcional) marca "llevar invitado" (solo visible si el paquete seleccionado es
   compartible) y llena email/nombre.
5. Confirmar → `POST /api/reservations` con `purchaseId` explícito (+ datos de invitado si
   aplica). El backend revalida con `validatePackageAllowsClass`.

## Casos borde

- **Cambiar a un paquete no compartible** con "llevar invitado" ya marcado → se desmarca
  automáticamente y se limpian email/nombre del invitado, para nunca enviar datos de
  invitado con un paquete no compartible.
- **Gating del botón confirmar:** la condición actual
  (`!activePurchase?.hasActivePackage || classesRemaining <= 0`, líneas 1217-1218) pasa a
  basarse en el paquete seleccionado / `bookablePurchases.length`.
- **0 paquetes compatibles** (tiene activos pero ninguno sirve para esta clase, p. ej. solo
  un paquete privado): se bloquea confirmar con mensaje; no se intenta la reserva.
- **Corte de clase de prueba (trial cutoff):** sigue funcionando porque se evalúa contra el
  `packageId` seleccionado.
- **Revalidación del servidor:** el POST de reservas mantiene su validación; el endpoint
  nuevo es solo para presentar opciones, no relaja seguridad.

## Fuera de alcance (YAGNI)

- No se modifica `GET /api/user/active-purchase` (sigue sirviendo el resumen single-purchase
  que otras vistas consumen).
- No se toca el flujo de asignación de admin, ni el flujo de invitación al invitado, ni la
  página `/invitacion/[token]`.
- No se cambia la lógica de "vence primero" más allá de reutilizarla para el default.

## Verificación

- Adriana Bidegain (Trimestral + Private Flow activos): al abrir una clase grupal, el
  selector muestra solo el Trimestral (Private Flow oculto por `isPrivate`); el checkbox de
  invitado aparece.
- Gabriela G. Lucha (solo Trimestral activo tras vencer el Drop-In): selector con 1 opción,
  checkbox visible.
- Persona con un solo paquete no compartible: sin selector, sin checkbox, comportamiento
  igual al actual.
- Reservar con invitado descuenta 1 clase del paquete seleccionado y crea la reserva con
  `guestEmail`/`guestStatus='PENDING'` como hoy.
