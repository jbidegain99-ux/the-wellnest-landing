# Trinity Flow (bundle) + Flow Viajero — Diseño

**Fecha:** 2026-05-14
**Estado:** Aprobado para implementación

## Contexto

Agregar 2 paquetes nuevos al catálogo de Wellnest:

1. **Trinity Flow** — $60, 6 clases divididas en una combinación FIJA: 2 Pole + 2 Pilates + 2 Yoga, 30 días de vigencia.
2. **Flow Viajero** — $215, 40 clases en cualquier disciplina, 60 días de vigencia.

Flow Viajero es un paquete normal (sin restricciones por disciplina). Trinity Flow requiere un mecanismo nuevo: el sistema actual maneja `Purchase.classesRemaining` como un único contador, mientras que Trinity Flow necesita rastrear saldos independientes por disciplina (2/2/2).

## Decisión de arquitectura

**Bundle de 3 paquetes hijos (Opción A).** El paquete visible "Trinity Flow" es un *bundle* que, al comprarse, genera 3 Purchases independientes —una por disciplina— en lugar de una sola Purchase con classCount=6.

**Por qué este enfoque y no extender el modelo:**
- Cero cambios al motor de reservas (rama crítica con muchos puntos de plomería: shared packages, refunds, deduct admin, allocations).
- Reutiliza `PackageDiscipline` que ya filtra Purchases por disciplina al elegir cuál usar para una reserva.
- Es el único caso conocido con esta restricción; un nuevo modelo `PurchaseDisciplineBalance` no se justifica por YAGNI.
- Trade-off: en la base de datos hay 3 Purchases por compra de Trinity Flow. Mitigado en UI agrupando por `bundleGroupId`.

## Cambios al schema

`prisma/schema.prisma`:

```prisma
model Package {
  // ...campos existentes
  isHidden            Boolean   @default(false)   // oculto del listing público; permitido como child de un bundle
  bundleChildSlugs    String[]  @default([])      // si no vacío, este paquete es un bundle que genera N child Purchases
}

model Purchase {
  // ...campos existentes
  bundleParentPackageId String?                   // FK lógico a Package — el bundle que originó esta Purchase
  bundleGroupId         String?                   // cuid generado al comprar el bundle, agrupa siblings
  @@index([bundleGroupId])
}
```

`bundleParentPackageId` se modela como FK con `onDelete: SetNull` (el child Purchase sobrevive si se borra el bundle padre, conserva su saldo, sólo pierde la etiqueta de agrupamiento). Si querés relación bidireccional explícita: `bundleParent Package? @relation("BundleChildren", fields: [bundleParentPackageId], references: [id], onDelete: SetNull)` y en `Package`: `bundleChildren Purchase[] @relation("BundleChildren")`.

Migración: `prisma migrate dev --name add_package_bundles`.

## Datos a sembrar

Script: `scripts/seed-trinity-and-viajero.ts` (idempotente vía upsert por slug).

### Paquetes child (ocultos)

Los 3 son `isActive: true, isHidden: true`. No aparecen en el listing público pero pueden ser referenciados como children de un bundle.

| slug | classCount | validityDays | PackageDiscipline | price |
|---|---|---|---|---|
| `trinity-pole-2` | 2 | 30 | pole | 0 |
| `trinity-pilates-2` | 2 | 30 | pilates | 0 |
| `trinity-yoga-2` | 2 | 30 | yoga | 0 |

`price=0` porque el dinero vive en la Order del bundle padre. Los children no se venden directamente.

### Paquete bundle visible

| Campo | Valor |
|---|---|
| slug | `trinity-flow-6` |
| name | `Trinity Flow (6 clases)` |
| subtitle | `Una combinación pensada para explorar distintas formas de bienestar` |
| price | 60 |
| classCount | 6 |
| validityDays | 30 |
| bundleChildSlugs | `['trinity-pole-2','trinity-pilates-2','trinity-yoga-2']` |
| PackageDiscipline | pole, pilates, yoga (sólo para chips en el grid) |
| order | 2.5 (entre Mini Flow 4 y Balance Pass 8) — renumerar a integer si schema no acepta decimales; ver nota |
| isShareable | false |
| singlePurchaseOnly | false |

Bullets:
- `bulletsTop`: `['2 clases de Pole', '2 clases de Pilates', '2 clases de Yoga']`
- `fullDescription`: `'Un paquete creado para que vivas una experiencia variada dentro de Wellnest, combinando fuerza, control, movilidad y conexión.'`
- `bulletsBottom`: `['Incluye 2 Pilates, 2 Yoga y 2 Pole', 'Debe utilizarse bajo esta combinación', 'Reserva fácil desde la app', 'Cancela tu clase 8 horas antes']`

**Nota sobre `order`:** el campo es `Int`. Reordenar los packages existentes así para insertar Trinity Flow:
- ease-in: -2 (igual)
- private-flow: -1 (igual)
- drop-in-class: 1 (igual)
- mini-flow-4: 2 (igual)
- **trinity-flow-6: 3 (NUEVO)**
- balance-pass-8: 4 (era 3)
- energia-total-12: 5 (era 4)
- apertura-full-access-24: 6 (era 5)
- wellnest-trimestral-80: 7 (era 6)
- **flow-viajero-40: 8 (NUEVO)**
- special-balance-5: 9 (era 8)

### Paquete normal Flow Viajero

| Campo | Valor |
|---|---|
| slug | `flow-viajero-40` |
| name | `Flow Viajero (40 clases)` |
| subtitle | `Tu práctica, tu ritmo, tu espacio` |
| price | 215 |
| classCount | 40 |
| validityDays | 60 |
| PackageDiscipline | (ninguna — todas las disciplinas) |
| order | 8 |

Bullets:
- `bulletsTop`: `['40 clases', '2 meses de vigencia', 'Todas las disciplinas incluidas']`
- `fullDescription`: `'Pensado para acompañarte durante dos meses con acceso a una experiencia más completa dentro de Wellnest. Ideal para quienes quieren integrar el movimiento y el bienestar como parte real de su rutina.'`
- `bulletsBottom`: `['Acceso a todas las disciplinas', 'Perfecto para profundizar en tu práctica', 'Reserva fácil desde la app', 'Cancela tu clase 8 horas antes']`

## Lógica de checkout

`src/lib/payments/markOrderPaid.ts` — modificar el bucle de creación de Purchases:

```ts
import { createId } from '@paralleldrive/cuid2'  // o el cuid que use el repo

for (const item of order.items) {
  const pkg = item.package

  // Caso bundle
  if (pkg.bundleChildSlugs.length > 0) {
    const bundleGroupId = createId()
    const children = await tx.package.findMany({
      where: { slug: { in: pkg.bundleChildSlugs } },
    })
    if (children.length !== pkg.bundleChildSlugs.length) {
      throw new Error(`Bundle ${pkg.slug}: missing child packages`)
    }
    for (const child of children) {
      await tx.purchase.create({
        data: {
          userId: order.userId,
          packageId: child.id,
          classesRemaining: child.classCount,
          expiresAt: addDays(new Date(), pkg.validityDays), // vigencia del PADRE
          originalPrice: 0,
          finalPrice: 0,
          paymentProviderId: order.paymentProviderId,
          bundleParentPackageId: pkg.id,
          bundleGroupId,
        },
      })
    }
    continue  // NO crear Purchase para el bundle padre
  }

  // Caso normal (existente)
  await tx.purchase.create({ ... })
}
```

**Invariantes:**
- La Order conserva el monto total ($60) y el invoice DTE — sin cambios al flujo de facturación.
- `expiresAt` de los 3 children es idéntico (vigencia del padre, no del child).
- `paymentProviderId` se replica en los 3 children para auditoría.

**Edge case — `singlePurchaseOnly`:** el chequeo actual en `src/app/paquetes/page.tsx` (líneas 62-72) compara `Purchase.packageId` contra paquetes con `singlePurchaseOnly`. Como los children apuntan a los slugs `trinity-*`, no al bundle padre, el bloqueo no dispararía si Trinity Flow tuviera `singlePurchaseOnly=true`. **Fix:** ampliar el query a `OR: [{ packageId: { in: ids } }, { bundleParentPackageId: { in: ids } }]`. Trinity Flow se siembra con `singlePurchaseOnly=false`, pero el fix se incluye para que el sistema sea coherente si en el futuro se quiere marcar como single-purchase.

**Edge case — `isShareable`:** Trinity Flow se siembra con `isShareable=false`. Si en el futuro se quiere compartible, hay que decidir si se comparten los 3 children individualmente o el bundle como unidad. Fuera de scope.

## Lógica de reservas

**Sin cambios.** El flujo en `src/app/api/reservations/route.ts`:

1. Usuario quiere reservar una clase de disciplina X.
2. Endpoint busca Purchases del usuario con `classesRemaining > 0`, status `ACTIVE`, no expiradas, y filtra por `PackageDiscipline` que matchee con disciplina X.
3. Cada child Purchase de Trinity Flow tiene exactamente 1 entrada en `PackageDiscipline` (pole, pilates o yoga). El filtro existente las trata como cualquier otra Purchase.
4. Decremento atómico de `classesRemaining` con guard `>= 0` — sin cambios.

**Cancelaciones, refunds, deduct admin, share:** sin cambios. Operan sobre child Purchases individualmente. Si en el futuro se requiere refund del bundle completo, se puede buscar por `bundleGroupId` y operar sobre los 3 — fuera de scope.

## UI — Dashboard del usuario

Archivos afectados:
- `src/app/(dashboard)/perfil/paquetes/page.tsx` — query y agrupamiento
- `src/components/dashboard/StatusCard.tsx` — render del bundle (si aplica)

**Query:** incluir `bundleParentPackageId`, `bundleGroupId`, y resolver el Package padre cuando `bundleParentPackageId` no es null. Resolver disciplina del child desde `PackageDiscipline` (los children tienen exactamente 1).

**Agrupamiento (en server component):**
```ts
const grouped: Array<NormalPurchase | BundlePurchase> = []
const bundleMap = new Map<string, BundlePurchase>()

for (const p of purchases) {
  if (p.bundleGroupId) {
    let bundle = bundleMap.get(p.bundleGroupId)
    if (!bundle) {
      bundle = {
        kind: 'bundle',
        groupId: p.bundleGroupId,
        parentPackage: parentPackagesById.get(p.bundleParentPackageId!),
        expiresAt: p.expiresAt,
        children: [],
      }
      bundleMap.set(p.bundleGroupId, bundle)
      grouped.push(bundle)
    }
    bundle.children.push({
      disciplineName: p.package.disciplines[0]?.discipline.name ?? p.package.name,
      remaining: p.classesRemaining,
      total: p.package.classCount,
      purchaseId: p.id,
    })
  } else {
    grouped.push({ kind: 'single', purchase: p })
  }
}
```

**Render del bundle:**
```
┌─ Trinity Flow (6 clases) ───────────────────┐
│  Vence: 14 jun 2026                         │
│                                             │
│  • Pole       2 / 2 disponibles             │
│  • Pilates    1 / 2 disponibles             │
│  • Yoga       2 / 2 disponibles             │
│                                             │
│  Total: 5 / 6 clases                        │
└─────────────────────────────────────────────┘
```

- Título y bullets vienen del **Package padre** (`parentPackage`).
- Cada línea = 1 child Purchase, con su disciplina y saldo.
- `expiresAt` se toma de cualquier child (todos iguales).
- Total = suma de `classesRemaining` de los children / suma de `classCount` de los children.

**Reservar desde el dashboard:** sin cambios. El flow "reservar X" pasa al endpoint el `classId`; el endpoint elige automáticamente la child Purchase correcta vía `PackageDiscipline`. Si el usuario tiene varias Purchases válidas para la misma disciplina (ej. una Pole de Trinity y una Pole de otro paquete), el orden actual de selección decide cuál usar — sin cambios.

## UI — Admin

**Sin cambios** en `/admin/usuarios/[id]`, `/admin/reembolsos`, `/admin/sesiones-privadas`, etc. Para staff es información útil ver las 3 Purchases separadas (pueden hacer refunds parciales, deductions, etc.). Si después se quiere agrupar también allí, es follow-up.

## Frontend público — listado de paquetes

`src/app/paquetes/page.tsx` y `PackagesGrid.tsx`: sin cambios funcionales; agregar al `where` el filtro `isHidden: false`.

```ts
where: { isActive: true, isHidden: false }
```

El bundle Trinity Flow se renderiza como cualquier otro paquete; los children quedan invisibles.

## Plan de migración / rollout

1. Crear migración Prisma con los 3 campos nuevos (`isHidden`, `bundleChildSlugs`, `bundleParentPackageId`, `bundleGroupId`).
2. Ejecutar `prisma db push` (o `migrate deploy` en prod).
3. Correr `npx tsx scripts/seed-trinity-and-viajero.ts` (idempotente).
4. Deploy del código (markOrderPaid + dashboard + filter en listing).
5. Verificar visualmente: el grid muestra Trinity Flow + Flow Viajero, los 3 children no aparecen.
6. Test E2E manual: comprar Trinity Flow → ver 3 entries en perfil agrupadas como "Trinity Flow" → reservar Pole → saldo Pole baja a 1.

## Testing

Tests a agregar (vitest):
- `markOrderPaid.test.ts`: comprar bundle genera 3 Purchases con `bundleGroupId` igual y `bundleParentPackageId` correcto.
- `markOrderPaid.test.ts`: comprar bundle con `validityDays=30` setea `expiresAt = now + 30d` en los 3 children, ignorando los `validityDays` de los children.
- Reservation test (smoke): purchase child de Pole sólo aplica a clase de Pole, no a Pilates.

## Out of scope

- Agrupar children en admin pages.
- Refund completo de bundle (operar sobre los 3 a la vez). Sigue siendo posible refund individual.
- Compartir bundle (`isShareable`).
- Transferir saldo entre disciplinas dentro del bundle.

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +4 campos |
| `prisma/migrations/...` | nueva migración |
| `scripts/seed-trinity-and-viajero.ts` | NUEVO |
| `src/lib/payments/markOrderPaid.ts` | branch para bundles |
| `src/app/paquetes/page.tsx` | `isHidden: false` en where; renumerar `order` |
| `src/app/(dashboard)/perfil/paquetes/page.tsx` | query + agrupamiento |
| `src/components/dashboard/StatusCard.tsx` (o nuevo `BundleStatusCard.tsx`) | render del bundle |
| Tests en `src/lib/payments/__tests__/` | nuevos casos |
