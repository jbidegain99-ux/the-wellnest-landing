# Auditoría E2E — The Wellnest (wellneststudio.net)

**Fecha:** 10 de junio de 2026
**Repositorio:** `/home/jose/the-wellnest-landing` — Next.js 14 (App Router) + Prisma 5/Postgres + NextAuth v4 + Payway (Banco Cuscatlán) + facturador DTE externo. Deploy en Vercel.

**Metodología.** La auditoría se ejecutó con 24 auditores en paralelo, cada uno enfocado en un subsistema (auth, reservas, pagos, admin, cron/webhooks, schema, etc.) o en un lente transversal (autorización, condiciones de carrera, timezone, manejo de errores). Cada hallazgo de severidad critical, high o medium fue después verificado por un agente adversarial independiente que intentó refutarlo contra el código real; 2 hallazgos fueron refutados y descartados del reporte. Los hallazgos de severidad baja **no** pasaron por verificación adversarial. Los duplicados detectados por varios auditores se consolidaron aquí en un solo hallazgo raíz, anotando todos los archivos afectados.

---

## 1. Resumen ejecutivo

El sitio es funcional y el dominio de negocio está bien modelado (paquetes, reservas, lista de espera, invitados, sesiones privadas, DTE), con varios patrones buenos ya presentes (transacciones con guard de créditos negativos en reservas, helpers de timezone, resultado discriminado en bookable-purchases tras el "bug de Paola"). Sin embargo, la auditoría encontró **problemas explotables hoy en el flujo de dinero**: el callback de Payway no verifica autenticidad (cualquier usuario puede marcar su orden como pagada sin pagar), la acreditación de órdenes y la cancelación de reservas tienen condiciones de carrera que permiten duplicar compras o "mintear" créditos, y existen seeds destructivos desplegados en producción que con un clic borran todas las clases y, por cascada, todo el historial de reservas — agravado porque el `.env` local apunta a la base de producción.

En el plano de integridad financiera/fiscal: los bundles pagados nunca emiten DTE y se registran con `finalPrice = 0` (invisibles para finanzas y conciliación bancaria), todo el dinero se modela como `Float` sin redondear, los filtros de fecha de ventas usan UTC en vez de hora El Salvador, y el export CSV de ventas se trunca a 200 filas en silencio — exactamente las causas raíz del tipo de discrepancias banco-vs-Purchase que se han venido persiguiendo en las auditorías mensuales. Además hay credenciales (`admin123`) y un código de descuento del 100% (`GRATIS100`) hardcodeados en el repositorio y recreables por el seed de producción.

**Conteo de hallazgos confirmados (brutos, antes de agrupar):** 9 críticos, 47 altos, ~127 medios y ~128 bajos (~311 en total; los bajos no fueron verificados adversarialmente). Agrupados por causa raíz: **4 críticos, 30 altos, ~50 medios y ~45 bajos**.

**Los 5 riesgos más importantes:**

1. **Bypass total de pago:** el callback de Payway marca órdenes como PAID sin firma, sin consulta a Payway y sin validar monto; cualquier usuario registrado puede acreditarse paquetes gratis (`src/app/api/payments/payway/callback/route.ts`).
2. **Seeds destructivos en producción:** `prisma.class.deleteMany({})` en `prisma/seed.ts` y en `POST /api/admin/seed` borra en cascada todas las reservas/asistencias sin reembolsar créditos; el `.env` local apunta a producción.
3. **Races de dinero:** doble acreditación de órdenes (idempotencia check-then-act en `markOrderPaid`) y doble reembolso al cancelar reservas en paralelo (minteo ilimitado de créditos).
4. **Credenciales y código 100% de descuento en el repo:** `admin@thewellnest.sv/admin123` y `GRATIS100` (100%, 1000 usos) creados/recreados por los seeds.
5. **Hueco fiscal y contable de bundles:** ventas reales de bundles sin DTE y con ingreso registrado en $0, más dinero en `Float` sin redondear y reportes con ventanas UTC desplazadas 6 horas.

---

## 2. Hallazgos CRÍTICOS

### C1. Seeds destructivos: borran TODAS las clases y, en cascada, todas las reservas, asistencias y listas de espera — sin reembolsar créditos
**Archivos:** `prisma/seed.ts:537-538`, `src/app/api/admin/seed/route.ts:466`, `src/components/admin/SeedDatabaseButton.tsx:32-34` (relacionados: `src/app/api/admin/clear-classes/route.ts:32-34`, `src/app/api/admin/cleanup/route.ts:64-77`)

Ambos seeds ejecutan `prisma.class.deleteMany({})` sin filtro ni guard de entorno. Como `Reservation.classId` y `Waitlist.classId` tienen `onDelete: Cascade` (`prisma/schema.prisma:317` y `348`), esto elimina irreversiblemente todo el historial de reservas (incluyendo asistencias ATTENDED que alimentan los pagos a instructores) y la lista de espera, sin devolver las `classesRemaining` ya descontadas. El endpoint `POST /api/admin/seed` está **desplegado en producción** y es invocable por cualquier sesión ADMIN (el botón `SeedDatabaseButton` solo lo protege un `confirm()`); además sobreescribe los precios reales de los paquetes con valores hardcodeados desactualizados (Drop-In 10.00 vs 15.00, etc.). El `.env` local apunta a la base de **producción**, así que un `npx prisma db seed` accidental destruye datos reales.

```ts
// Delete existing classes to avoid duplicates
await prisma.class.deleteMany({})
// schema.prisma:317
class Class @relation(fields: [classId], references: [id], onDelete: Cascade)
```

**Recomendación:** Bloquear ambos seeds en producción (abortar si `NODE_ENV === 'production'` / `VERCEL_ENV === 'production'`, o exigir `SEED_ALLOW_DESTRUCTIVE=1` + allowlist de hosts en `DATABASE_URL`). Eliminar el `deleteMany({})` global: borrar solo clases futuras sin reservas (`dateTime > now, reservations: { none: {} }`). Quitar los campos `price`/`isActive` del upsert de paquetes. Eliminar `SeedDatabaseButton` (código muerto) y restringir `clear-classes`/`cleanup` a entornos no productivos. Separar seed de desarrollo (datos fake) del de producción (solo catálogo).

---

### C2. Bypass total de pago: el callback de Payway no verifica firma, autenticidad ni monto
**Archivo:** `src/app/api/payments/payway/callback/route.ts:96-162` (handler GET: `182-233`; `parsePaywayCallback` en `src/lib/payments/payway.ts:160-186`)

El endpoint es público (el middleware no cubre `/api/payments`) y marca la orden como PAID y crea los Purchases con solo recibir un `orderId` en estado PENDING. No hay verificación de firma/HMAC, ni consulta server-to-server a Payway, ni exigencia de que exista `pwoAuthorizationNumber`, ni comparación del monto pagado contra `order.total`. El comprador conoce su propio `orderId` (se muestra en la URL y en pantalla en `payway/[orderId]/page.tsx:666`), por lo que puede crear una orden desde la UI y luego ejecutar `curl -X POST '/api/payments/payway/callback?oid=<suOrden>'` — o incluso un GET desde el navegador con `pwoAuthorizationNumber=x` — para activar sus paquetes **sin pagar**. Pérdida directa de dinero explotable hoy.

```ts
const order = await prisma.order.findUnique({ where: { id: orderId } })
if (order.status !== 'PENDING') { ... }
const result = await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY', transactionData: {...} })
```

**Recomendación:** No confiar en el callback como prueba de pago: (1) verificar la transacción server-to-server contra la API de consulta de Payway (estado APPROVED y monto == `order.total`) antes de llamar `markOrderPaidAndCreatePurchase`, o como mínimo (2) incluir un HMAC propio en la URL de callback (va cifrada con `PAYWAY_TOKEN_ENCRYPT` hacia Payway: `?oid=X&sig=HMAC(orderId, secreto)`) y rechazar requests sin firma válida; (3) rechazar callbacks sin `pwoAuthorizationNumber`/`pwoReferenceNumber` y no procesar pagos por GET; (4) allowlist de IPs de Payway en el WAF de Vercel como defensa en profundidad.

---

### C3. Cancelación concurrente de la misma reserva produce doble reembolso (minteo de créditos)
**Archivo:** `src/app/api/reservations/cancel/route.ts:107-113, 172-207` (mismo patrón en `src/app/api/admin/attendance/cancel-reservation/route.ts:51-78`)

El check "ya cancelada" ocurre fuera de la transacción y, dentro de ella, el `reservation.update` es incondicional por id (no filtra `status`). Dos requests paralelos (doble clic o dos curls) leen ambos `CONFIRMED`, ambos ejecutan la transacción y ambos hacen `classesRemaining: { increment: classesRefunded }`: el usuario recupera 2 clases (4 con invitado) por una sola reserva. Ciclo explotable: reservar (−1) + doble-cancelar (+2) = +1 clase gratis por iteración, sin límite.

```ts
const updatedReservation = await tx.reservation.update({
  where: { id: reservationId },
  data: { status: 'CANCELLED', cancelledAt: new Date() }, ...
classesRemaining: { increment: classesRefunded },
```

**Recomendación:** Dentro de la transacción usar update condicional: `tx.reservation.updateMany({ where: { id, status: { not: 'CANCELLED' } }, ... })` y abortar con 400 si `count === 0`. Aplicar lo mismo a la reserva hermana del invitado (calcular `classesRefunded` del count real cancelado dentro de la transacción) y a la ruta admin de cancelación.

---

### C4. `markOrderPaid`: idempotencia check-then-act sin guard atómico permite doble acreditación de compras (y doble DTE)
**Archivos:** `src/lib/payments/markOrderPaid.ts:72-81, 238-244`; `prisma/schema.prisma:182` (`paymentProviderId` sin `@unique`); TOCTOU también en `callback/route.ts:109-123`

La verificación `order.status === 'PAID'` ocurre fuera de la transacción y el `order.update` final es incondicional. Dos invocaciones concurrentes (POST de Payway + GET del redirect del navegador, reintentos, o dos POSTs deliberados al callback público) leen ambas PENDING y ambas crean el set completo de Purchases, PaymentTransaction y envío al facturador → el cliente recibe el doble de clases por un solo pago y se emiten dos DTEs. La última defensa, `paymentProviderId`, es determinístico (`payway_{orderId}_{itemId}_{i}`) pero **no** tiene `@unique` en el schema, así que la BD no bloquea duplicados. Esto explica posibles purchases duplicadas como las investigadas en las auditorías mensuales. El check de `singlePurchaseOnly` (líneas 85-108) sufre la misma carrera.

```ts
if (order.status === 'PAID') {
  return { success: true, alreadyPaid: true }
}
// schema.prisma:182
paymentProviderId String?  @map("stripePaymentId")  // sin @unique
```

**Recomendación:** Dentro de `prisma.$transaction`, como PRIMERA operación hacer el claim atómico: `tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date() } })` y retornar `alreadyPaid` si `count === 0`; solo entonces crear PaymentTransaction y Purchases. Agregar `@unique` a `Purchase.paymentProviderId` (tras deduplicar datos existentes; cambiar los `trial_${Date.now()}` a valores determinísticos `trial_${userId}_${packageId}`) como defensa en profundidad, e idealmente añadir `orderId` con FK en Purchase para trazabilidad de conciliación.

---

## 3. Hallazgos ALTOS

### H1. Next.js 14.2.33 con múltiples CVEs high sin parchear (varios solo corregidos en 15.x)
**Archivo:** `package.json:35`

npm audit reporta 16 advisories. Dos DoS high se corrigen en 14.2.34/14.2.35, pero varios high/moderate (DoS RSC, SSRF vía WebSocket, cache poisoning RSC, DoS del Image Optimizer) solo tienen fix en 15.5.x porque Next 14 es EOL. Los DoS de RSC son explotables sin autenticación contra este App Router público.

```json
"next": "^14.2.33"  // npm audit: 8 advisories high; fix completo solo en >=15.5.16
```

**Recomendación:** Inmediato: subir a la última 14.2.x (>=14.2.35). Corto plazo: planificar migración a Next 15.5.x (mayormente mecánica en App Router).

### H2. Todo el dinero se modela como `Float` y los cálculos se persisten sin redondear
**Archivos:** `prisma/schema.prisma:132, 139, 179-180, 360, 508, 544, 601-603, 633-634`; `src/lib/payments/markOrderPaid.ts:135-137`; `src/app/api/orders/route.ts:161-167`; `src/app/api/checkout/route.ts:56-58`

`finalPrice = originalPrice * (1 - pct/100)` se guarda con residuos de flotante (p. ej. 62.991000000000003) mientras el banco cobra 62.99 (`toFixed(2)` en `payway.ts:61-63`). Diferencias de centavos sistemáticas entre `Purchase.finalPrice`/`Order.total` y los abonos de Banco Cuscatlán — la causa raíz del tipo de discrepancias que persiguen las auditorías mensuales. Además, cliente y servidor usan fórmulas distintas para el descuento, y la detección de orden gratuita usa `total === 0` estricto.

```ts
const finalPrice = originalPrice * (1 - discountPercentage / 100) // se persiste sin redondear
```

**Recomendación:** Helper `roundMoney(n) = Math.round(n*100)/100` aplicado a subtotal/discount/total/finalPrice antes de persistir (garantizando `Order.total` == monto enviado a Payway). Migrar los campos monetarios a `Decimal @db.Decimal(10,2)`, priorizando `Purchase.finalPrice` y `Order.total`.

### H3. Código de descuento `GRATIS100` (100%, 1000 usos, todos los paquetes) creado por ambos seeds
**Archivos:** `prisma/seed.ts:510-521`, `src/app/api/admin/seed/route.ts:441-451`

El código está en texto plano en el repo, aplica a todos los paquetes y se recrea cada vez que corre el seed (anulando desactivaciones manuales). Cualquiera que lo conozca obtiene paquetes de hasta $355 gratis.

```ts
create: { code: 'GRATIS100', percentage: 100, maxUses: 1000, validUntil: ... }
```

**Recomendación:** Verificar de inmediato en producción si `GRATIS100` (y `WELCOME10`/`PRIMERA20`) existen; desactivarlos/borrarlos y auditar `PromoRedemption`. Eliminar su creación de ambos seeds.

### H4. Credenciales hardcodeadas: `admin@thewellnest.sv/admin123` y `test@example.com/test123` (con compra activa) en seeds y bootstrap
**Archivos:** `prisma/seed.ts:456-481, 613-626`; `src/app/api/admin/seed/route.ts:404-414`; `src/app/api/admin/bootstrap/route.ts:7-38`

Usuario ADMIN con password `admin123` en el repositorio; bootstrap (sin autenticación, mitigado por `userCount > 0`) lo crea en cualquier BD vacía y devuelve las credenciales en la respuesta JSON. El usuario test recibe una Purchase activa con 6 clases.

```ts
const hashedPassword = await bcrypt.hash('admin123', 12)
await prisma.user.upsert({ where: { email: 'admin@thewellnest.sv' }, ... role: 'ADMIN' })
```

**Recomendación:** Verificar/rotar en producción la cuenta admin y eliminar el usuario test y su purchase. Leer credenciales de seed desde env vars obligatorias; en bootstrap, exigir `BOOTSTRAP_SECRET` y generar password aleatoria nunca retornada en texto plano.

### H5. El service worker cachea HTML de páginas autenticadas y nunca se limpia al cerrar sesión
**Archivo:** `public/sw.js:33-37`

Toda navegación GET exitosa se guarda en `wellnest-v1`, incluyendo `/perfil` y `/admin` (ventas, usuarios, reportes), ignorando `Cache-Control: no-store`. No hay limpieza en `signOut`: en un dispositivo compartido, basta ir offline para ver el HTML con datos del usuario anterior (también inspeccionable vía DevTools).

```js
if (response.ok && request.mode === 'navigate') {
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
}
```

**Recomendación:** Excluir `/perfil` y `/admin` (o cualquier respuesta `no-store`/`private`) del `cache.put`, usando solo el fallback a `/offline.html`; ejecutar `caches.delete('wellnest-v1')` en el handler de signOut.

### H6. Cobro realizado sin acreditación: el fallo se traga sin registro persistente y la UI invita a pagar de nuevo
**Archivos:** `src/app/(dashboard)/checkout/payway/[orderId]/page.tsx:304-315`; `src/app/api/payments/payway/callback/route.ts:142-148` (GET sin try/catch ni logging: `211-245`)

Cuando `markOrderPaid` falla tras un cargo real (paquete single-purchase ya poseído, error de DB), el callback solo hace `console.error` (logs de Vercel expiran en ~1h) y redirige con `?status=error&reason=processing_failed`; no queda PaymentTransaction ni registro consultable. La página muestra "intenta de nuevo" y el botón reinicializa el pago sobre la misma orden: si el usuario obedece, se le cobra dos veces, y el primer cargo es invisible para el sistema.

```ts
if (!result.success) {
  console.error('[PAYWAY CALLBACK] Failed to process payment:', result.error)
  return NextResponse.redirect(.../checkout/payway/${orderId}?status=error&reason=processing_failed`...)
```

**Recomendación:** Persistir el fallo antes de redirigir (PaymentTransaction/WebhookLog con rawPayload + email de alerta a admins). Para `processing_failed`, NO ofrecer reintentar: mostrar "estamos verificando tu pago, no vuelvas a pagar" y disparar reconciliación. Replicar el manejo en el handler GET (hoy redirige sin parámetro de error y sin try/catch).

### H7. Exportación CSV de ventas truncada silenciosamente a 200 filas
**Archivos:** `src/app/admin/ventas/page.tsx:106-120`; `src/app/api/admin/sales/route.ts:20`

El botón pide `limit=10000` pero el API clampa a 200 (`Math.min(200, ...)`) y el cliente vuelca `data.sales` sin comparar contra `pagination.total`. Cualquier export con >200 ventas (un mes completo) produce un CSV contable incompleto sin aviso.

**Recomendación:** Paginar el export en el cliente hasta cubrir `pagination.total`, o endpoint dedicado `/api/admin/sales/export` sin clamp; como mínimo, error visible si `sales.length < total`.

### H8. Cancelación admin no maneja invitados: reembolsa 1 clase en vez de 2 y deja el cupo del invitado huérfano
**Archivo:** `src/app/api/admin/attendance/cancel-reservation/route.ts:56-86`

La ruta siempre cancela solo la fila indicada con `increment: 1`, sin buscar la reserva hermana `isGuestReservation=true` (como sí hace el flujo de usuario). El cliente pierde 1 de las 2 clases descontadas y la fila del invitado queda CONFIRMED bloqueando cupo permanentemente; en la UI ambas filas muestran el mismo nombre, facilitando cancelar la equivocada.

**Recomendación:** Replicar la lógica del cancel de usuario: cancelar la hermana en la misma transacción y reembolsar 2 clases (manejando también el caso inverso). Advertir en el modal cuando hay invitado.

### H9. Auto-asignación de lista de espera al cancelar desde Asistencias no verifica que la clase no haya terminado
**Archivo:** `src/app/api/admin/attendance/cancel-reservation/route.ts:96-148`

Al corregir asistencias de clases pasadas, se promueve al primero de la waitlist: se le crea reserva CONFIRMED, se le descuenta 1 clase y se le envía "¡Se liberó un cupo!" para una clase que ya ocurrió. El usuario pierde un crédito sin poder asistir.

**Recomendación:** Solo auto-asignar si `reservation.class.dateTime > new Date()`; añadir limpieza de waitlist de clases pasadas.

### H10. Marcar una clase como cancelada (`isCancelled`) no devuelve créditos ni cancela/notifica reservas — y el DELETE recomienda ese flujo
**Archivo:** `src/app/api/admin/classes/[id]/route.ts:31, 204, 279-285`

`PUT isCancelled=true` solo cambia el flag: reservas CONFIRMED vivas, créditos no devueltos, nadie notificado, waitlist sin procesar; el GET admin además filtra `isCancelled: false`, dejando reservas "huérfanas" invisibles. El mensaje del DELETE empuja explícitamente a este flujo.

**Recomendación:** Al cancelar una clase, en una transacción: marcar reservas CANCELLED, reembolsar `classesRemaining` (reactivando DEPLETED), limpiar waitlist y enviar emails. Idealmente endpoint dedicado `POST /api/admin/classes/[id]/cancel` y quitar `isCancelled` del PUT genérico.

### H11. Cleanup borra clases de cualquier instructor/disciplina fuera de una lista blanca hardcodeada
**Archivo:** `src/app/api/admin/cleanup/route.ts:64-77`

`class.deleteMany` para todo instructor cuyo id no esté en `OFFICIAL_INSTRUCTOR_IDS` (5 cuids del seed original). Cualquier instructor/disciplina legítimo creado después es tratado como "no oficial" y sus clases se borran con cascada sobre reservas y asistencias.

**Recomendación:** No basar la limpieza en IDs estáticos: flag `isProtected` en DB o confirmación explícita de los IDs a borrar; nunca borrar clases con reservas.

### H12. Códigos de descuento expiran un día antes (fechas date-only parseadas como medianoche UTC)
**Archivos:** `src/app/api/admin/discount-codes/route.ts:91-99`; `src/app/api/admin/discount-codes/[id]/route.ts:112-113`

`new Date('YYYY-MM-DD')` = medianoche UTC = 18:00 SV del día anterior. Un código "válido hasta 30/06" deja de funcionar a las 18:00 del 29/06: todo el último día anunciado el código falla (ventas perdidas); `validFrom` activa 6 h antes. La propia lista admin muestra la fecha corrida.

```ts
const validFrom = new Date(data.validFrom)
const validUntil = new Date(data.validUntil)
```

**Recomendación:** Anclar a SV: `fromZonedTime(y,m,d, 00:00 / 23:59:59.999, 'America/El_Salvador')` en POST y PATCH; migrar los registros existentes.

### H13. Clave AES de Payway expuesta en la respuesta JSON del endpoint admin (`?test=1`)
**Archivo:** `src/app/api/admin/payway/route.ts:52-65`

`keyFirst32Chars` devuelve exactamente los 32 bytes usados como clave AES-256-CBC para cifrar montos y callbacks (ver `encryptPaywayValue`, `payway.ts:44-50`), contradiciendo la invariante documentada. Quien la obtenga puede forjar montos cifrados válidos. `encryptionTest` además entrega pares plaintext/ciphertext con IV fijo.

**Recomendación:** Eliminar `keyFirst32Chars` (idealmente todo `encryptionTest`); rotar `PAYWAY_TOKEN_ENCRYPT` si el endpoint ya fue usado con `?test=1`.

### H14. Aprobación de reembolsos: `customAmount` sin validar, tres escrituras sin transacción y no cancela reservas del paquete
**Archivo:** `src/app/api/admin/refunds/route.ts:67-124` (escrituras sin tx: `100-124`; purchase→EXPIRED: `112-116`)

`customAmount` acepta montos negativos o mayores a lo pagado; las escrituras RefundRequest→Purchase→PromoRedemption no son atómicas (puede quedar REFUNDED con paquete ACTIVE); y las reservas CONFIRMED futuras de la purchase reembolsada no se cancelan: el usuario cobra el reembolso y sigue asistiendo.

**Recomendación:** Validar con zod (`customAmount` positivo y `<= purchase.finalPrice`), envolver todo en `prisma.$transaction`, y cancelar en la misma transacción las reservas futuras de esa purchase (liberando waitlist).

### H15. Filtro de fechas del reporte/listado de ventas calculado en UTC: ventana desplazada 6 horas
**Archivo:** `src/app/api/admin/sales/route.ts:56-67`

`new Date(startDate)` (medianoche UTC = 18:00 SV del día anterior) + `end.setHours(23,59,59,999)` en el servidor UTC: el cierre mensual incluye la noche del último día del mes anterior y excluye la noche del último día del rango. Inconsistente con `/api/admin/finances/summary`, que sí usa `fromZonedTime` — dos reportes con totales distintos para "el mismo día".

**Recomendación:** Replicar `resolveRange` de finances/summary (`fromZonedTime` SV para inicio/fin de día); extraer helper `svDateRangeFromYmd()` en `src/lib/utils/timezone.ts` y usarlo en ambos.

### H16. Emails sin normalizar en registro/login vs. normalizados en forgot-password: usuarios con mayúsculas no pueden recuperar su cuenta
**Archivos:** `src/app/api/auth/register/route.ts:25-50`; `src/lib/auth.ts:21-23`; `src/app/api/auth/forgot-password/route.ts:22`

El registro y `authorize()` usan el email crudo (case-sensitive en Postgres) pero forgot-password lo pasa a minúsculas: `Maria@gmail.com` nunca recibe el enlace y el sistema le responde éxito (falso negativo permanente). También permite cuentas duplicadas que solo difieren en mayúsculas.

**Recomendación:** `trim + toLowerCase` en registro, authorize y forgot/reset, más migración de datos a minúsculas (verificando colisiones).

### H17. Los mensajes del formulario de contacto no llegan a nadie (sin email ni UI admin)
**Archivo:** `src/app/api/contact/route.ts:27-42`

El endpoint guarda en `ContactMessage` y responde "Mensaje enviado exitosamente", pero el envío de email está comentado y ningún otro código del repo consume esa tabla. Clientes potenciales perdidos en silencio.

```ts
// Here you would typically send an email notification
// await sendEmail({ to: 'admin@thewellnest.sv', subject, ... })
```

**Recomendación:** Conectar `sendEmail` (Microsoft Graph) tras el create y/o crear una vista admin de ContactMessage con estado leído/no leído.

### H18. `/api/disciplines` y `/api/instructors` se sirven como snapshot estático del build (datos congelados hasta el próximo deploy)
**Archivos:** `src/app/api/disciplines/route.ts:4-15`; `src/app/api/instructors/route.ts`

Ambos handlers GET sin `export const dynamic = 'force-dynamic'` quedan prerenderizados (confirmado en `.next/prerender-manifest.json`, `initialRevalidateSeconds: false`). Cambios de admin (nuevo instructor, disciplina desactivada) no se reflejan en el sitio ni en los dropdowns de /horarios y /reservar hasta el siguiente deploy.

**Recomendación:** Añadir `export const dynamic = 'force-dynamic'` (o `revalidate = 60`) a ambos, como ya tiene `/api/classes/route.ts:6`; verificar el prerender-manifest tras el build.

### H19. Cobro sin producto: `POST /api/orders` no valida `singlePurchaseOnly` y el fallo se detecta después del cargo
**Archivo:** `src/app/api/orders/route.ts:129-137`

`/api/checkout` y el carrito sí validan, pero la creación de órdenes Payway no: `markOrderPaid` rechaza en el callback, **después** de que Payway cobró la tarjeta. La orden queda PENDING, no se crean Purchases y la PaymentTransaction se rollbackea: cobro real sin contrapartida ni evidencia (descuadre directo con el banco).

**Recomendación:** Validar `singlePurchaseOnly` (409) en `POST /api/orders` y/o en el init de Payway. En `markOrderPaid`, registrar la PaymentTransaction APPROVED fuera de la transacción que crea purchases para que siempre quede evidencia del cargo.

### H20. `claim-trial`: reclamos ilimitados de paquetes gratis no marcados `singlePurchaseOnly`, ignora `isHidden`/`isPrivate` y es vulnerable a TOCTOU
**Archivo:** `src/app/api/packages/claim-trial/route.ts:43-94`

Solo valida `price === 0` e `isActive`; si el paquete no es `singlePurchaseOnly`, puede reclamarse infinitas veces, incluso paquetes gratuitos ocultos por ID. Aun con `singlePurchaseOnly`, el findFirst+create sin transacción ni unique permite duplicar el trial con requests concurrentes (`paymentProviderId` usa `trial_${Date.now()}`).

**Recomendación:** Rechazar `isHidden`/`isPrivate`; tratar todo paquete gratis como compra única; `paymentProviderId` determinístico `trial_${userId}_${packageId}` con `@unique` capturando P2002 → `SINGLE_PURCHASE_LIMIT`.

### H21. Emails fire-and-forget en funciones serverless: pueden no enviarse nunca, sin registro del fallo
**Archivos:** `src/app/api/private-sessions/route.ts:160-162`; `src/app/api/reservations/route.ts:932-951`; `src/app/api/admin/private-sessions/[id]/route.ts:100-109, 215-231`; `src/app/api/webhooks/facturador/route.ts:181-183`

El propio código documenta en `markOrderPaid.ts:255-256` que en Vercel hay que hacer `await`, pero estos 4 puntos retornan la respuesta sin esperar: notificaciones de sesión privada al admin (negocio perdido), confirmaciones de reserva con QR, confirmación/rechazo de sesión privada y email de factura pueden perderse de forma intermitente e invisible.

**Recomendación:** `await` antes de responder o `waitUntil()` de Vercel en los 4 puntos.

### H22. Sistema de referidos roto de facto: el código nunca matchea (mayúsculas vs cuid) y la recompensa nunca se otorga
**Archivo:** `src/app/api/referrals/route.ts:88-95` (recompensa: `44-46`)

`qrCode` es un cuid (siempre minúsculas) pero la búsqueda hace `startsWith: code.toUpperCase()` sin `mode: 'insensitive'`: todo código válido devuelve "no válido". Además ningún código del repo marca Referral como COMPLETED ni asigna `classesEarned`/aplica `discountApplied`: las métricas siempre son 0 y el 10% prometido nunca se aplica.

**Recomendación:** Campo `referralCode` dedicado y normalizado con match exacto (o `mode: 'insensitive'`); implementar la activación en la primera compra del referido o retirar la UI que promete beneficios inexistentes.

### H23. Promoción desde lista de espera insegura: sin validar paquete compatible, falla en silencio bloqueando la cola, sin guards de crédito ni capacidad
**Archivo:** `src/app/api/reservations/cancel/route.ts:237-292, 268-292, 329-332`

La auto-asignación toma `purchases[0]` sin filtrar `isPrivate`/disciplinas/cutoff de trial ni conflictos de horario (cargos indebidos con email de confirmación). Si el promovido tuvo una reserva cancelada en esa clase, el `create` viola el unique (P2002), el catch lo traga y el usuario queda eternamente en posición 1 bloqueando a todos. El decrement no tiene guard de negativo ni marca DEPLETED, no se recheckea capacidad, y al liberarse 2 cupos (invitado) solo se promueve a 1.

**Recomendación:** Extraer un helper compartido en `src/lib/booking/` que aplique los mismos filtros y guards del POST de reservas; reactivar reservas CANCELLED en vez de crear; iterar al siguiente de la cola ante fallos; promover tantas personas como cupos liberados; registrar fallos en DB.

### H24. Overbooking: el chequeo de capacidad ocurre fuera de la transacción y nunca se re-verifica
**Archivo:** `src/app/api/reservations/route.ts:222-228, 867-901` (invitados: `767-825`; reactivación: `442-469`; sin guard en BD: `prisma/schema.prisma:295-296`)

La capacidad se valida con `_count.reservations` antes de la transacción; dentro solo se protege `classesRemaining`. Dos usuarios reservando el último cupo en paralelo pasan ambos: clase sobrevendida (el unique solo protege al mismo usuario). El flujo de invitado (2 cupos) agrava la ventana, y la promoción de waitlist compite por el mismo cupo.

**Recomendación:** Re-verificar dentro de la transacción serializando sobre la fila de Class (`SELECT ... FOR UPDATE` + recount, o contador atómico `updateMany({ where: { currentCount: { lte: maxCapacity - seats } }, data: { increment: seats } })` abortando si `count === 0`). Aplicar a creación, invitado, reactivación y promoción de waitlist.

### H25. El chequeo anti-solape de horarios está roto: `findFirst` devuelve una reserva arbitraria y solo se evalúa esa
**Archivo:** `src/app/api/reservations/route.ts:505-555`

La query matchea todas las reservas pasadas aún CONFIRMED y `findFirst` sin `orderBy` devuelve una fila arbitraria: si el usuario tiene cualquier reserva vieja, la conflictiva real nunca se examina. El control TIME_CONFLICT es un falso negativo sistemático: se pueden reservar dos clases solapadas gastando créditos.

**Recomendación:** `findMany` acotado por ambos lados (`dateTime < classEndTime AND dateTime > inicio - MAX_DURATION AND dateTime >= now`) iterando todas las candidatas con su `duration`; test del caso "reserva vieja + solapada".

### H26. La transferencia de reserva a otro paquete omite compatibilidad de disciplina, paquetes privados y el corte del paquete de prueba
**Archivo:** `src/app/api/reservations/route.ts:281-357`

El camino de transferencia valida solo userId/ACTIVE/saldo/vigencia, sin `validatePackageAllowsClass` ni `isTrialBlockedForClass`. Explotable hoy: transferir una clase grupal a un paquete Private Flow o bypass del cutoff de trial (devuelve el crédito pagado y consume el gratis → clase sin costo).

**Recomendación:** Ejecutar los mismos guards que en creación/reactivación antes de la transacción de transferencia, devolviendo los mismos códigos de error.

### H27. `dashboard-status` calcula 'Hoy'/'Mañana' con el reloj UTC del servidor (incorrecto 6 horas cada noche) y muestra 'Manana' sin ñ
**Archivo:** `src/app/api/user/dashboard-status/route.ts:94-97`

`isToday/isTomorrow` comparan contra el reloj del servidor (UTC) mientras `classSV` está en hora SV: entre 18:00 y 23:59 SV, una clase de mañana se etiqueta "Hoy" y la de esta noche pierde la etiqueta.

**Recomendación:** `differenceInCalendarDays(classSV, nowSV)` (0 → 'Hoy', 1 → 'Mañana') reutilizando el `nowSV` ya calculado; corregir el literal a 'Mañana'.

### H28. Webhook del facturador devuelve 200 ante errores internos y no tiene idempotencia ni guarda de orden de eventos
**Archivo:** `src/app/api/webhooks/facturador/route.ts:124-129` (idempotencia/orden: `96-111`; estado regresionado habilita doble DTE vía `send-invoice`)

Un fallo transitorio de Prisma responde `{received:true}` con 200: el facturador nunca reintenta y la Purchase queda con `invoiceStatus` desactualizado sin dteUuid ni email al cliente (y sin rastro en WebhookLog). Además `x-webhook-delivery` no se usa para deduplicar: un `dte.created` tardío regresiona `completed → processing`, un `dte.rejected` tardío pisa una factura aprobada y un `dte.approved` duplicado reenvía el email.

**Recomendación:** Devolver 500 en el catch (handlers idempotentes), registrar el fallo en WebhookLog; deduplicar por deliveryId (índice único) y hacer los updates condicionales por estado (`updateMany ... NOT IN ('completed')`).

### H29. `StatusCard` (y la página de reservar) muestran 'Sin paquete activo' como falso negativo ante errores del API
**Archivos:** `src/components/dashboard/StatusCard.tsx:31-47`; `src/app/(dashboard)/reservar/page.tsx:349-359`

Ante un 401/500, `data` queda null y se renderiza exactamente el estado de "sin paquete / sin reservas" (patrón Paola). Un usuario con paquete vigente puede creer que lo perdió y comprar de nuevo.

**Recomendación:** Estado de error explícito con botón de reintento (reutilizar el patrón discriminado ya aplicado a bookable-purchases); distinguir 401 (redirigir a login) de 500.

### H30. Bundles pagados: Purchases hijas con `finalPrice = 0` → sin DTE (incumplimiento fiscal) e invisibles en finanzas/conciliación
**Archivo:** `src/lib/payments/markOrderPaid.ts:140-177, 345-371` (consumidores: `src/app/api/admin/finances/summary/route.ts`; tests que cementan el comportamiento: `markOrderPaid.test.ts:106-110`)

La rama de bundle crea solo hijas con `originalPrice: 0, finalPrice: 0` y no crea Purchase padre. `triggerFacturacion` filtra `finalPrice > 0` → una venta real cobrada vía Payway (p. ej. bundles Trinity) **nunca emite DTE** y el log lo presenta como caso legítimo; el dashboard financiero agrega solo `Purchase.finalPrice` → el dinero del bundle aparece como $0 (descuadre banco-vs-Purchase permanente). El match de orderItem por `packageId` (línea 371) tampoco encontraría a las hijas.

```ts
const paidPurchases = purchases.filter((p) => p.finalPrice > 0)
if (paidPurchases.length === 0) { console.log('[FACTURADOR] No paid purchases to invoice, skipping'); return }
```

**Recomendación:** Facturar a nivel de OrderItem (precio del bundle padre) o prorratear el precio real entre las hijas; convertir "orden con monto > 0 y 0 purchases facturables" en error visible (`invoiceStatus: 'failed'`). Auditar en DB bundles ya vendidos vía Payway sin DTE. Agregar tests que afirmen que la suma de `finalPrice` de las Purchases del bundle = monto cobrado y que `sendToFacturador` se invoca.

---

## 4. Hallazgos MEDIOS (verificados adversarialmente; formato compacto)

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|-----------|---------------|
| M1 | Open redirect en /login vía `?redirect=` sin validar | `src/app/(auth)/login/page.tsx:14,39` | Aceptar solo rutas internas (`startsWith('/') && !startsWith('//')`) |
| M2 | Login ignora `callbackUrl` del middleware; deep-links protegidos aterrizan en la home | `login/page.tsx:14`; `(dashboard)/layout.tsx:73` | Leer `redirect ?? callbackUrl` validado; propagar la ruta real en el layout |
| M3 | Sin rate limiting ni lockout en login/registro/forgot/reset | `src/lib/auth.ts:16-45` | Rate limit por IP+email (Upstash/Vercel WAF) en `/api/auth/*` |
| M4 | El rol ADMIN vive en el JWT y nunca se revalida (revocación sin efecto hasta 30 días) | `src/lib/auth.ts:56-62` | Re-leer rol desde BD periódicamente en el callback jwt; reducir maxAge |
| M5 | Reset de contraseña no invalida sesiones JWT existentes (igual en change-password) | `src/app/api/auth/reset-password/route.ts:68-77` | `passwordChangedAt`/`sessionVersion` en el token y verificación en callbacks |
| M6 | forgot-password responde éxito aunque el envío del email falle (y ya invalidó el token previo) | `src/app/api/auth/forgot-password/route.ts:59-78` | Devolver 500 cuando el usuario existe y sendEmail falla; invalidar tokens solo tras envío exitoso |
| M7 | IDOR en /api/cart: PATCH/DELETE no verifican que el item pertenezca a la sesión | `src/app/api/cart/route.ts:142-194` | `updateMany/deleteMany` con `{ id, sessionId }`; validar quantity entera con tope |
| M8 | POST /api/referrals sin autenticación: forja de referidos con userId/email arbitrarios | `src/app/api/referrals/route.ts:76-151` | Exigir sesión y derivar referredUserId del usuario en sesión |
| M9 | GET /api/admin/assets/[key] sin verificación de sesión/rol | `src/app/api/admin/assets/[key]/route.ts:10-33` | Mismo guard ADMIN que el PUT |
| M10 | Firma HMAC del facturador no cubre el timestamp: anti-replay inefectivo (ambos sentidos) | `src/lib/facturador/client.ts:144-149, 204-242` | Firmar `${timestamp}.${rawBody}` (patrón Stripe), coordinado con el facturador |
| M11 | Inyección de HTML en plantillas de email (notes, nombres sin escapar) | `src/lib/emailService.ts:1055-1058` | Helper `escapeHtml()` en toda interpolación de datos de usuario |
| M12 | CSV injection en export de ventas (fórmulas `=`, `+`, `@` sin sanitizar) | `src/app/admin/ventas/page.tsx:123-141` | Anteponer `'` a celdas que empiecen con caracteres de fórmula |
| M13 | /api/contact sin rate limiting, sin captcha y sin `.max()` en campos | `src/app/api/contact/route.ts:5-35` | max() en zod, honeypot y rate limit por IP |
| M14 | /api/classes/[id] expone clases privadas/canceladas sin auth; nadie valida `class.isPrivate` en reservas/waitlist/cancelación (sesiones 1:1 reservables/canceladas por la vía genérica) | `src/app/api/classes/[id]/route.ts:11-25`; `src/app/api/reservations/route.ts:180-240`; `cancel/route.ts:146-200` | `findFirst` con `isPrivate:false, isCancelled:false`; rechazar isPrivate en reservas/waitlist; cancelación de privadas sincroniza Class + PrivateSessionRequest |
| M15 | Settings: página mayormente placebo, guarda `stripeSecretKey` en texto plano, acepta claves arbitrarias | `src/app/api/admin/settings/route.ts:9-20, 70-78`; `src/app/admin/configuracion/page.tsx:205-218` | Whitelist zod, eliminar campos Stripe vestigiales, enmascarar secretos; `cancellationHours` además gobierna reembolsos (no cancelación) sin validar NaN — renombrar o conectar al cancel |
| M16 | `remotePatterns` con hostname `'**'`: optimizador de imágenes como proxy abierto/facturable | `next.config.js:3-11` | Lista explícita de hosts permitidos |
| M17 | .gitignore no cubre dumps/auditorías con datos de producción presentes en el working tree | `.gitignore` | Replicar patrones de .vercelignore (backup_*, audit_*, *.xlsx, scripts/_data/); mover dumps fuera del repo |
| M18 | Sin historial de migraciones: solo `prisma db push` contra producción | `package.json:11` | Adoptar `prisma migrate` con baseline; permite CHECKs e índices parciales |
| M19 | xlsx@0.18.5 con prototype pollution y ReDoS sin fix en npm (hoy solo se escribe, no se parsea input no confiable) | `package.json:45` | Migrar a la dist oficial de SheetJS >=0.20.2 o a exceljs |
| M20 | `onDelete: Cascade` desde User destruye registros fiscales DTE, órdenes y reembolsos | `prisma/schema.prisma:172, 315, 611, 520-521` | `Restrict` en Purchase/Order + soft-delete/anonimización |
| M21 | `Class.currentCount` zombi: nunca se incrementa al reservar pero otros endpoints lo leen/decrementan | `prisma/schema.prisma:296`; `cancel-reservation:80-85` | Eliminarlo (derivar de `_count`) o mantenerlo atómico y usarlo como guard de capacidad |
| M22 | `Package.slug` sin `@unique`: seeds findFirst no atómicos y `bundleChildSlugs` ambiguos | `prisma/schema.prisma:126` | Deduplicar y declarar `@unique`; upsert real por slug |
| M23 | Índices faltantes en rutas calientes (Class.dateTime, Purchase.userId/status, Reservation.classId, Waitlist.classId) | `prisma/schema.prisma:285-354` | Añadir los `@@index` listados y aplicar en horario valle |
| M24 | `prisma/seed.ts` crea clases en TZ local del servidor (sin offset SV, a diferencia del seed admin) | `prisma/seed.ts:585-601` | Helper compartido `svLocalToUtc()` usado por ambos seeds |
| M25 | SW: precache de /perfil (cachea el login o HTML autenticado y puede romper la instalación), respuestas 408 vacías como falsos negativos de red, `CACHE_NAME` nunca versionado (offline roto tras deploys) | `public/sw.js:1-9, 40-48, 1, 11-20` | Precachear solo /offline.html; devolver `Response.error()`; versionar CACHE_NAME por build |
| M26 | Carrito y checkout muestran "Tu carrito está vacío" cuando la API falla; mutaciones sin feedback | `src/app/(dashboard)/carrito/page.tsx:41-57`; `checkout/page.tsx:61-91` | Estado de error con reintento (patrón discriminado ya usado en perfil/reservas) |
| M27 | Sin polling del estado de la orden durante el pago: la página depende 100% del redirect de Payway | `checkout/payway/[orderId]/page.tsx:561-584` | Polling de la orden cada 5-10 s en estado 'processing'; navegar a success al detectar PAID |
| M28 | Falsos estados vacíos ante 500 en Lista de Espera, Historial, Invitaciones, nav-badges, calendario de reservar y horarios público | `perfil/espera/page.tsx:27-39`; `reservar/page.tsx:458-485`; `horarios/page.tsx:350-359` y otros | Rama else de error + botón Reintentar en todos los fetch de carga |
| M29 | Trial vigente + paquete pagado: la UI bloquea TODAS las clases como "Solo paquete pagado" aunque el backend permitiría reservar | `reservar/page.tsx:187-190, 998-1001` | Bloquear solo si el trial es el único paquete utilizable; dejar que el modal resuelva con bookable-purchases |
| M30 | /reservar renderiza horas y agrupa días en TZ del navegador (igual en /horarios público) | `reservar/page.tsx:541-552`; `horarios/page.tsx:372-397` | Formatear/agrupar con `America/El_Salvador` (helpers de lib/utils) |
| M31 | Check-in manual: toggle ciego sin confirmación, sin manejo de errores ni guard de doble tap | `admin/asistencias/[classId]/page.tsx:133-147` | Acción explícita check-in/undo, botón deshabilitado en vuelo, error visible |
| M32 | Errores tragados en páginas admin (asistencias, detalle de clase, horarios, usuarios, reembolsos) | `admin/asistencias/page.tsx:68-82`; `admin/reembolsos/page.tsx:91-118` | Helper fetch con resultado discriminado + banner de error |
| M33 | Reordenar instructores: dos PUT en paralelo sin atomicidad ni chequeo de errores (orden duplicado) | `admin/instructores/page.tsx:275-304` | Endpoint `reorder` transaccional; verificar res.ok |
| M34 | Búsqueda de Ventas: debounce muerto (request por tecla) y respuestas fuera de orden | `admin/ventas/page.tsx:90-100` | debouncedQuery real + AbortController/token de secuencia |
| M35 | Cancelación admin: doble reembolso por check-then-act (carrera con la cancelación del usuario) | `admin/attendance/cancel-reservation/route.ts:51-78` | `updateMany` condicional dentro de la transacción (ver C3) |
| M36 | Bootstrap público crea admin con `admin123` en cualquier BD vacía y expone userCount | `src/app/api/admin/bootstrap/route.ts:7-38, 49-56` | BOOTSTRAP_SECRET + password aleatoria; no exponer userCount (ver H4) |
| M37 | Creación de clases recurrentes ancla "hoy" y el día de semana en UTC: de 6pm a medianoche SV la serie se corre una semana; el modal de Horarios además ignora la fecha de la celda | `src/app/api/admin/classes/route.ts:257-291`; `admin/horarios/page.tsx:356-371` | Calcular "hoy" en SV (`getStartOfTodaySV`) o enviar la fecha exacta de la celda y usar `svLocalToUTC` |
| M38 | clear-classes borra reservas sin reembolsar las clases descontadas | `src/app/api/admin/clear-classes/route.ts:32-34` | Reembolsar antes de borrar; restringir a entornos no productivos (ver C1) |
| M39 | Finanzas/ventas no restan reembolsos aprobados (bruto/neto/IVA sobreestimados) | `src/app/api/admin/finances/summary/route.ts:60-72` | Restar RefundRequest REFUNDED del periodo o excluir purchases reembolsadas |
| M40 | `getNowInSV()` (epoch corrido -6h) usado en filtros Prisma contra timestamps UTC | `admin/opportunities/route.ts:18-20, 38-49`; `user/nav-badges/route.ts:22-44`; `reports/trial-users` | Usar `new Date()` en queries; documentar que getNowInSV es solo para formateo |
| M41 | Listado admin de paquetes con `take: 25` fijo: el catálogo excedente desaparece sin aviso | `src/app/api/admin/packages/route.ts:43-47` | Eliminar el take o paginar con total |
| M42 | Confirmar sesión privada no valida `expiresAt` del paquete ni choque de horario del instructor | `admin/private-sessions/[id]/route.ts:138-175` | Validar vencimiento y solape de Class del instructor (409 con detalle) |
| M43 | send-invoice: factura precio de catálogo ignorando descuentos, no es idempotente y no bloquea estado 'processing' (doble DTE) | `admin/purchases/[id]/send-invoice/route.ts:54-87` | Usar finalPrice real cuando > 0; claim atómico de invoiceStatus; bloquear 'processing' |
| M44 | reallocate/unshare de paquetes compartidos: check-then-act no atómico, resucitan purchases vencidas y borran `classesAllocated` histórico | `admin/shared-packages/reallocate/route.ts:41-87`; `unshare/route.ts:32-77` | Guard post-decremento (como private-sessions), optimistic lock, validar expiresAt, conservar histórico |
| M45 | deduct-package escribe balance absoluto sin transacción (lost update) y el motivo solo va a console.log (sin auditoría) | `admin/users/[id]/deduct-package/route.ts:84-114` | `updateMany` con `decrement` condicionado + tabla `PackageAdjustment` visible en el historial |
| M46 | Historial de usuario y Ventas clasifican asignaciones admin (pos_manual/gift) como "PayWay" | `admin/users/[id]/history/route.ts:70-89`; `api/admin/sales/route.ts:47-53, 94` | Reutilizar `classifyPayment()` de `lib/finance/calculate.ts` |
| M47 | Listado de usuarios muestra como "activos" paquetes vencidos (no existe job ACTIVE→EXPIRED) | `src/app/api/admin/users/route.ts:48-69` | Helper compartido de "paquete activo" (status+expiresAt+saldo) en todas las vistas |
| M48 | Path gratis/test de /api/checkout: no maneja bundles, crea purchases en loop sin transacción y la redención puede chocar con el unique tras una redención VOID (duplicación al reintentar) | `src/app/api/checkout/route.ts:53-123` | Unificar acreditación en `markOrderPaidAndCreatePurchase`; una sola transacción con PromoRedemption primero; paymentProviderId determinístico |
| M49 | Límite global `maxUses` de descuentos no atómico: se valida al crear la orden pero el increment al pagar es incondicional (y órdenes PENDING pueden pagarse con código ya expirado) | `discount/validate/route.ts:76-82`; `markOrderPaid.ts:229-233` | UPDATE condicional con SQL raw (`currentUses < maxUses`) dentro de la transacción; re-validar en payway/init |
| M50 | /api/classes sin rango devuelve toda la tabla histórica con includes completos (endpoint público sin límite) | `src/app/api/classes/route.ts:43-98` | Exigir startDate+endDate (400), acotar rango máximo y usar `select` |
| M51 | Cron de pagos a instructores: si el email falla no hay reintento, alerta ni persistencia del Excel | `src/app/api/cron/instructor-payments/route.ts:126-135` | Retry con backoff + registro en DB + runbook de re-disparo con `?weekStart` |
| M52 | Webhook del facturador no resuelve el formato compuesto `orderId_purchaseId` que Wellnest mismo envía como referencia | `webhooks/facturador/route.ts:72-93`; `lib/facturador/client.ts:117` | Fallback: extraer el segmento tras el último `_` y reintentar lookup |
| M53 | Refund: monto mal calculado para compartidos (ignora `classesAllocated`), bundles (finalPrice=0 → $0) y paquetes con classCount editado; no valida estado de la purchase ni bloquea refunds COMPLETED previos (doble reembolso) | `src/app/api/refund/route.ts:44-93` | Usar `classesAllocated ?? classCount` snapshot, clamp [0, finalPrice], rechazar status != ACTIVE, incluir COMPLETED en el filtro de duplicados |
| M54 | Transferencia de paquete con invitado activo descuadra créditos entre paquetes al cancelar | `cancel/route.ts:147-196` | Reembolsar cada reserva a su propio purchaseId, o bloquear transferencia con invitado |
| M55 | Re-reservar una clase cancelada ignora silenciosamente al invitado solicitado (éxito parcial) | `src/app/api/reservations/route.ts:361-495` | Manejar guestData en la reactivación o rechazar con 400 explícito |
| M56 | Waitlist: posición asignada con read-then-write sin transacción (posiciones duplicadas) y el GET muestra clases ya pasadas | `src/app/api/waitlist/route.ts:122-137, 17-44` | Ordenar por createdAt (derivar posición) o `@@unique([classId, position])` con retry; filtrar `dateTime > now` |
| M57 | payment/success afirma "Pago Exitoso" sin verificar el estado real de la orden (cadena de confirmación confiable-por-URL) | `src/app/payment/success/page.tsx:29-44` | Consultar el estado de la orden y renderizar verificando/éxito/pendiente; manejar el caso sin sesión |
| M58 | PackagesGrid: fallo al agregar al carrito sin ningún feedback (venta perdida) | `src/app/paquetes/PackagesGrid.tsx:118-131` | `setCartError` en el else genérico y en el catch |
| M59 | /horarios: error de active-purchase produce falso "Necesitas un paquete activo" | `src/app/horarios/page.tsx:318-332` | Tres estados (cargando/error/datos); no bloquear con el modal ante error |
| M60 | DuplicateConfigModal permite enviar el lote con conflictos detectados (creaciones parciales) | `src/components/admin/duplicate/DuplicateConfigModal.tsx:209-216` | Deshabilitar envío con `conflicts.length > 0` o filtrar las filas en conflicto |
| M61 | `React.useId()` llamado condicionalmente en Input y Textarea (violación de Reglas de Hooks) | `src/components/ui/Input.tsx:13`; `Textarea.tsx:12` | Hook incondicional: `const gen = React.useId(); const id2 = id ?? gen` |
| M62 | Footer enlaza /privacidad y /cancelacion inexistentes (404 en páginas legales) | `src/components/layout/Footer.tsx:22-26` | Crear las páginas o redirigir a /terminos#... |
| M63 | EXCLUDED_USER_IDS hardcodeado y duplicado entre constants.ts e instructorPayments.ts (drift afecta pagos a instructores) | `src/lib/instructorPayments.ts:30-33`; `src/lib/constants.ts:5-8` | Importar de un solo lugar; de fondo, flag `isTestAccount` en User |
| M64 | markOrderPaid.test.ts solo cubre bundles: idempotencia, singlePurchaseOnly, redenciones y facturación sin ningún test | `src/lib/payments/markOrderPaid.test.ts:35-259` | Tests para already-PAID, no-PENDING, redención + increment, aserciones sobre sendToFacturador |
| M65 | Sin reintento automático para DTEs con invoiceStatus 'failed' (obligación fiscal con plazos) | `src/lib/payments/markOrderPaid.ts:398-410` | Cron horario de reintentos con backoff + alerta a admins; detectar 'sent_to_facturador' sin webhook tras N horas |
| M66 | Paquetes expiran a la hora exacta de compra pero la UI promete validez por fecha completa | `markOrderPaid.ts:156,184`; `checkout:73`; `claim-trial:78`; `assign-package:114-115` | Helper `svEndOfDayAfterDays()` (23:59:59 SV); migración opcional de expiresAt vigentes |
| M67 | Reporte trial-users: N+1 queries y no excluye cuentas de prueba (métricas infladas e inconsistentes) | `admin/reports/trial-users/route.ts:94-136` | Una query `userId IN (...)` agrupada en memoria + filtro EXCLUDED_USER_IDS |
| M68 | Variante GET del callback de Payway: fallo de procesamiento totalmente silencioso y sin try/catch | `payway/callback/route.ts:211-245` | Replicar manejo del POST (log + redirect con reason + try/catch) — ver H6 |

---

## 5. Hallazgos BAJOS y mejoras (no verificados adversarialmente)

**Seguridad / configuración**
- Sin cabeceras de seguridad HTTP (X-Frame-Options/CSP/nosniff/Referrer-Policy) — `next.config.js:1-14`.
- ESLint sin configurar: `npm run lint` cae en prompt interactivo; reglas de Next nunca ejecutadas — `package.json:9`.
- Dependencias muertas con advisories: `stripe` y `nodemailer` no se usan en ningún import — `package.json:37,41`; `@types/*` y `typescript` en dependencies — `package.json:24-27,44`; next-auth v4 en mantenimiento con advisory moderate sin fix — `package.json:36`.
- Tokens de reset de contraseña almacenados en texto plano + consumo "un solo uso" no atómico — `forgot-password/route.ts:42-52`, `reset-password/route.ts:28-77`.
- Mensajes distintos en `authorize()` permiten enumeración de usuarios (y oráculo de timing) — `src/lib/auth.ts:25-36`.
- Contraseñas temporales con `Math.random()` y 8 caracteres — `admin/users/[id]/reset-password/route.ts:13-31`.
- Comparación de `CRON_SECRET` no constante en tiempo — `cron/instructor-payments/route.ts:72-75`.
- `sendToFacturador` envía sin HMAC silenciosamente si falta `FACTURADOR_SV_WEBHOOK_SECRET` — `lib/facturador/client.ts:143-149`.
- PUT de assets acepta esquemas `javascript:`/`data:` y `type` arbitrario — `admin/assets/[key]/route.ts:47-72`.
- Detalles internos de Prisma (message/code) expuestos al cliente — `orders/route.ts:270-274`, `reservations/route.ts:999-1005`.
- Logging de PII: payload completo de Payway (nombre, últimos dígitos) a console — `payway/callback/route.ts:47`.
- Reflexión de texto arbitrario vía `?oid=` en /payment/success — `payment/success/page.tsx:67-71` (más: sin manejo del caso sin sesión, redirect al login abrupto — `:34-41`).
- Patrón laxo `if (!session)` + `session.user.id` potencialmente undefined (IDOR latente) — `user/active-purchase/route.ts:13-20`; change-password no invalida JWTs — `user/change-password/route.ts:60-67`.
- `generateQRCode` con Math.random (código muerto, eliminar) — `src/lib/utils.ts:69-71`.

**Schema / datos**
- Estados críticos como String libre en vez de enum (invoiceStatus, guestStatus, WebhookLog.status) — `prisma/schema.prisma:199,329,...`.
- Constraints menores: ExcludedPurchase sin FK, Waitlist sin unique de posición, índice redundante del token de reset — `schema.prisma:276,344-354,580-590`.
- El unique de Reservation fija 1 invitado por clase a nivel BD, contradiciendo `maxShares` configurable — `schema.prisma:333`.
- Flujo de invitación por token es código muerto (`guestToken` nunca se genera) y declinar no libera cupo — `invitations/[token]/route.ts:12-95`.
- Órdenes PENDING huérfanas sin expiración y carrito vaciado antes de pagar — `orders/route.ts:185-216`.
- `TRIAL_PACKAGE_ID` (cuid de producción) hardcodeado — `src/lib/booking/trialCutoff.ts:9-11`; constantes duplicadas en la página de reservar (`reservar/page.tsx:70-72`); test del cutoff tautológico — `trialCutoff.test.ts:5-6`.
- Cancelación devuelve clases a paquetes ya vencidos comunicándolo como éxito — `cancel/route.ts:191-196`; updates de status DEPLETED/ACTIVE fuera de la transacción principal — `reservations/route.ts:914-923`.
- Payload al facturador con `purchaseDate = now` y `expirationDate` fija a +90 días — `lib/facturador/client.ts:120-121`.
- `ivaToPayMinistry` no acredita el IVA de la comisión 3DS (~2¢/transacción) — `lib/finance/aggregate.ts:143-144`.
- assign-package: `classCount` sin `.int().positive()` (balances negativos/fraccionarios) y excepción de facturación no persiste `invoiceStatus='failed'` — `admin/users/[id]/assign-package/route.ts:24, 197-200`.
- Historial de usuario muestra `originalPrice` ($) como denominador de clases — `history/route.ts:79`; conteos inflan reservas de invitado — `admin/users/route.ts:53-56`.

**Bugs/UX menores**
- Validación de descuento da falso positivo sin packageIds cuando hay `applicableTo` — `discount/validate/route.ts:84-95`.
- Checkbox "Recordarme" decorativo — `login/page.tsx:105-112`; total del checkout derivado de sessionStorage sin re-validar (solo display) — `checkout/page.tsx:93-104`.
- Estado "Pago Rechazado" (?status=denied) se pisa por la carga de la orden — `checkout/payway/[orderId]/page.tsx:108-166`; fechas de pago en TZ del navegador — `checkout/success/[orderId]/page.tsx:219-263`; GET del callback denied sin try/catch — `payments/payway/denied/route.ts:137-160`.
- Reservar: respuestas fuera de orden en resolveBookablePurchases (`reservar/page.tsx:601-630`), refresh post-reserva omite el filtro de disciplina (`:704-713`), setActivePurchase pisa el saldo de otro paquete (`:685-699`), formatClassDate sin locale es (`:568-571`), deep-link silencioso con clases pasadas/canceladas (`:495-531`), sin guard de reentrada en confirm (`:652-655`), closeModal no resetea selectedPurchase (`:803-817`), doble fetch inicial y payload con instructor completo (`:458-485`); layout redirige siempre a /perfil perdiendo el deep-link — `(dashboard)/layout.tsx:72-74`.
- Perfil: "Visa •••• 4242" ficticia — `perfil/page.tsx:429-444`; división por cero en barras de progreso — `perfil/paquetes/page.tsx:330-332`; nombres completos expuestos en sharedWith — `user/purchases/route.ts:84-105`; query pesada de purchases con reservas descartadas — `user/purchases/route.ts:23-47`.
- Estadísticas de usuario (mes/racha) con límites UTC — `user/history/route.ts:46-74`; nav-badges cuenta waitlist de clases pasadas — `nav-badges/route.ts:47-51`; notification-settings devuelve defaults con 200 ante error de BD — `user/notification-settings/route.ts:36-44`.
- Admin: selector de fecha de asistencias con toISOString (día equivocado en TZ positivas) — `admin/asistencias/page.tsx:63-71`; fetchAssets invita al seed ante error — `admin/assets/page.tsx:36-52`; tabla de métodos de pago oculta OFFLINE — `admin/finanzas/page.tsx:276-302`; header de rango en UTC — `:189-192`; formulario de instructores sin campo de foto — `admin/instructores/page.tsx:53-61`; sesiones privadas: error nunca se limpia (`:83-98`), datetime-local en TZ del navegador (`:374-379`), pestaña CANCELLED inexistente (`:160`); ventas: export falla en silencio — `admin/ventas/page.tsx:77-87`.
- API admin: editar clase permite `maxCapacity` menor a las reservas y cambios de hora/instructor sin notificar — `admin/classes/[id]/route.ts:186-204`; POST de clases sin detección de duplicados/solapes — `admin/classes/route.ts:300-312`; logging de debug excesivo y queries de diagnóstico en hot paths — `admin/classes/route.ts:42-104`, `api/classes/route.ts:113-140`; endpoint de debug calcula la semana en UTC — `admin/debug/route.ts:81-87`; DELETE de disciplina no contempla PrivateSessionRequest (500 por FK) — `admin/disciplinas/[id]/route.ts:139-151`; PUT de discount-codes valida fechas solo si vienen ambas — `discount-codes/[id]/route.ts:112-125`; oportunidades: baja ocupación cuenta clases futuras/privadas (`opportunities:101-104`), carritos "abandonados" de hace 2 minutos (`:52-59`), carga todo en memoria (`:64-74`); refunds GET castea status sin validar (500) — `admin/refunds/route.ts:17-20`.
- Reservas API: errores internos en el mensaje al usuario (`reservations:999-1005`), transferencia bloqueada si la clase está llena (`:221-228`), datos de invitado sin zod (`:160-161`), auto-select de reactivación sin filtros de compatibilidad (`:379-390`); private-sessions: race de solicitudes duplicadas (`private-sessions:96-150`) y sin validar vigencia del paquete vs fecha pedida (`:111-117`); criterios de ocupación distintos entre reservas y waitlist — `waitlist/route.ts:78-80`; fechas malformadas en /api/classes → 500 (`classes:46-66`); notas internas de clases expuestas en el JSON público (`classes:82-98`); fallback a `currentCount` obsoleto en frontend.
- Webhook: eventos desconocidos registrados como 'processed' — `webhooks/facturador/route.ts:109-114`; cron sin try/catch global — `cron/instructor-payments/route.ts:92-93`.
- Front público: SEO incompleto (sin sitemap/robots/og:image; /horarios y /contacto sin metadata) — `src/app/layout.tsx:18-34`; registro del SW con `.catch(() => {})` — `layout.tsx:59-61`; `cache.put` sin `event.waitUntil` — `sw.js:36`; iframes de Google Maps con place IDs aparentemente fabricados — `page.tsx:241-250`; términos con teléfono placeholder, email de otro dominio y fecha 2024 — `terminos/page.tsx:171-174`; accesibilidad (botones sin aria-label, tarjetas no operables por teclado) — `Navbar.tsx:190-200`, `PackagesGrid.tsx:189-194`; checkbox dentro de button — `MobileScheduleView.tsx:99-115`; Avatar no reintenta al cambiar src — `Avatar.tsx:28`; duplicar clases hacia fechas pasadas — `DuplicateConfigModal.tsx:118-124`; updater impuro en useDuplicateMode — `useDuplicateMode.ts:174-182`; N+1 menor de children de bundle — `markOrderPaid.ts:140-149`; `getDaysRemaining` sin TZ SV — `utils.ts:73-79`.

---

## 6. Plan de remediación priorizado

### Semana 1 — Críticos + quick wins
| Acción | Hallazgos | Esfuerzo |
|---|---|---|
| Verificación de autenticidad en el callback Payway (consulta server-to-server o HMAC propio + monto + rechazar GET/sin authorizationNumber) | C2 | **M** |
| Claim atómico en `markOrderPaid` (`updateMany PENDING→PAID`) + `@unique` en `paymentProviderId` (tras deduplicar) | C4 | **M** |
| `updateMany` condicional en cancelaciones (usuario, invitado y admin) | C3, M35 | **S** |
| Guard de entorno en ambos seeds; eliminar `class.deleteMany({})`; bloquear `/api/admin/seed`, `clear-classes` y `cleanup` en producción; borrar SeedDatabaseButton | C1, H11, M38 | **S** |
| Verificar/desactivar en producción GRATIS100/WELCOME10/PRIMERA20; rotar admin@thewellnest.sv; eliminar usuario test; quitar credenciales y códigos de los seeds; proteger bootstrap | H3, H4, M36 | **S** |
| Eliminar `keyFirst32Chars`/`encryptionTest` y rotar `PAYWAY_TOKEN_ENCRYPT` | H13 | **S** |
| `processing_failed`: no ofrecer reintento de pago + persistir el fallo (PaymentTransaction/WebhookLog + alerta) | H6 | **S** |
| `force-dynamic` en /api/disciplines y /api/instructors | H18 | **S** |
| Ampliar .gitignore (backup_*, audit_*, *.xlsx, scripts/_data/) y sacar los dumps del árbol | M17 | **S** |
| Subir a Next 14.2.35 | H1 (parcial) | **S** |

### Semanas 2-4 — Altos
| Acción | Hallazgos | Esfuerzo |
|---|---|---|
| Re-chequeo de capacidad dentro de la transacción de reserva (FOR UPDATE/contador atómico); aplicar a invitados, reactivación y waitlist | H24 | **M** |
| Arreglar chequeo anti-solape (findMany acotado + iterar) | H25 | **S** |
| Guards de compatibilidad en transferencia y promoción de waitlist; helper compartido en `src/lib/booking/` con tests | H26, H23 | **M** |
| Bundles: facturar el monto real del OrderItem y registrar el ingreso en Purchase; auditar bundles ya vendidos sin DTE; tests de invariante | H30 | **M** |
| Webhook facturador: 500 en errores + dedupe por deliveryId + updates condicionales por estado; bloquear 'processing' en send-invoice | H28, M43 | **S** |
| `roundMoney()` en todos los cálculos + plan de migración a Decimal (empezar por finalPrice/total) | H2 | **M/L** |
| Fechas SV en discount-codes (POST/PATCH) y sales (helper `svDateRangeFromYmd`) | H12, H15 | **S** |
| Export CSV paginado o endpoint dedicado | H7 | **S** |
| Cancelación admin con invitados + no auto-asignar en clases pasadas + flujo `isCancelled` con reembolsos/notificaciones | H8, H9, H10 | **M** |
| Normalizar emails (registro/login/forgot) + migración de datos | H16 | **M** |
| Conectar email del formulario de contacto (+ vista admin) | H17 | **S** |
| Guards en claim-trial (isHidden/isPrivate/único + unique determinístico) | H20 | **S** |
| `await`/`waitUntil` en los 4 emails fire-and-forget | H21 | **S** |
| Referidos: corregir match o retirar la feature de la UI; decidir implementación de recompensas | H22 | **S/M** |
| SW: no cachear /perfil//admin, limpiar cache en signOut, precachear solo /offline.html, versionar CACHE_NAME | H5, M25 | **S** |
| Validar singlePurchaseOnly en /api/orders + PaymentTransaction fuera de la tx | H19 | **S** |
| Reembolsos: zod + transacción + cancelar reservas futuras | H14 | **M** |
| Estados de error visibles en StatusCard/reservar/carrito/checkout/perfil (helper fetch discriminado) | H29, M26, M28 | **M** |
| Fix Hoy/Mañana en dashboard-status | H27 | **S** |
| Planificar migración Next 15 + Auth.js v5 | H1 | **L** |

### Backlog — Medios y bajos
- Autorización y endurecimiento: rate limiting auth/contact, revalidación de rol en JWT, invalidación de sesiones al cambiar contraseña, IDOR de carrito, referrals con sesión, HMAC con timestamp firmado, escape de HTML en emails, CSV injection, headers de seguridad, remotePatterns. (S-M cada uno)
- Integridad de datos: migraciones Prisma, índices, `onDelete: Restrict` en registros fiscales, slug `@unique`, enums para estados, eliminar `currentCount`, helper único de "paquete activo", restar reembolsos en finanzas, auditoría de ajustes manuales, expiración fin de día SV, cron de reintento de DTEs. (M agregado)
- Concurrencia restante: maxUses atómico, checkout gratis transaccional, reallocate/unshare/deduct-package, waitlist position, refund duplicado. (S-M cada uno)
- Timezone restante: clases recurrentes (hoy SV), getNowInSV en queries, render en TZ SV en horarios/reservar, estadísticas de usuario. (S cada uno)
- UX/funcional: polling de orden en checkout, payment/success verificado, trial+pagado, footer legal, sesiones privadas (expiresAt/solape), ESLint + limpieza de dependencias, tests de markOrderPaid, todos los bajos listados en §5.

---

## 7. Recomendaciones estructurales

**Centralizar la lógica de dinero y reservas.** Hoy existen al menos tres rutas que acreditan compras (`markOrderPaid`, el path gratis/test de `/api/checkout`, `claim-trial`) y cuatro caminos que crean/reactivan reservas con validaciones distintas (creación, reactivación, transferencia, promoción de waitlist). Cada divergencia ya produjo un bug confirmado. Extraer servicios únicos en `src/lib/` (acreditación de órdenes, selector de paquete compatible, creación de reserva con guards) y que todas las rutas los consuman, con tests unitarios sobre las invariantes de dinero (suma de finalPrice == monto cobrado, créditos nunca negativos, idempotencia).

**Atomicidad como regla, no excepción.** El patrón check-then-act fuera de transacción aparece en pagos, cancelaciones, waitlist, descuentos, refunds y paquetes compartidos. Adoptar como convención: todo update de estado condicionado (`updateMany` con el estado esperado + verificación de `count`), constraints únicos en BD como segunda defensa (`paymentProviderId`, posiciones de waitlist) y migraciones versionadas (`prisma migrate`) para poder añadir CHECKs e índices parciales.

**Observabilidad de fallos de dinero.** Los logs de Vercel expiran en ~1 hora y hoy varios fallos críticos (cobro sin acreditar, DTE fallido, email no enviado, webhook descartado) solo viven en `console.error`. Persistir todo fallo de flujo financiero/fiscal en DB (WebhookLog/tabla de incidencias) con alerta por email a admins, y agregar un cron de reconciliación (órdenes PENDING con callback recibido, purchases con invoiceStatus failed/sent sin webhook).

**Manejo de errores en frontend.** Estandarizar el helper fetch con resultado discriminado (`{ok:true,data} | {ok:false,status}`) que ya se aplicó tras el bug de Paola y usarlo en todas las páginas (usuario y admin), de modo que "error de servidor" nunca se renderice como estado vacío legítimo.

**Dependencias y testing.** Next 14 está EOL: planificar 15.5.x junto con Auth.js v5 y la limpieza de stripe/nodemailer/xlsx. Configurar ESLint (`next/core-web-vitals`) en CI. Ampliar la suite de `src/lib` para cubrir los caminos de dinero (idempotencia de markOrderPaid, descuentos, facturación) — hoy la suite en verde da una confianza muy superior a su cobertura real.

**Timezone.** Documentar (y lint-ear) la convención: `new Date()` para comparaciones contra columnas UTC; `getNowInSV`/`formatInSV` solo para formateo; `fromZonedTime`/helpers `sv*` para límites de día/semana/mes y para parsear inputs `type=date`. Extraer `svDateRangeFromYmd()` y `svEndOfDayAfterDays()` y migrar los ~10 puntos detectados.
