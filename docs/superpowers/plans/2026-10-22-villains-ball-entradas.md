# The Villains Ball: entradas por transferencia — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vender las entradas del show de Halloween por transferencia, entregar un QR por persona vía WhatsApp y correo, controlar la puerta con check-in de un solo uso y convertir a cada asistente en usuario de Wellnest.

**Architecture:** Tres tablas nuevas (`Event`, `EventOrder`, `EventTicket`) creadas con SQL escrito a mano, sin `db push`. La lógica vive en `src/lib/events/*`: funciones puras con tests, más servicios que reciben Prisma y se prueban con mocks. Las rutas API son delgadas. Las páginas públicas van en el grupo `src/app/(evento)/` con fuentes y paleta propias; el admin va en `src/app/admin/eventos/`.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / Postgres, NextAuth (JWT, credentials), zod, `qrcode`, `@yudiel/react-qr-scanner` (vía `src/components/QRScanner.tsx`), Microsoft Graph (`sendEmail`), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-22-villains-ball-entradas-design.md`

**Referencia visual exacta (copy, tamaños, colores):** `docs/superpowers/specs/villains-ball-artboards/` contiene `A1-compra.html`, `A2-pago.html`, `A3-entrada.html`, `A4-checkin.html` y `A5-despues.html`. Son mockups de 390 px. Las URLs `/_blob/...` de esos archivos corresponden a `public/halloween/*.jpg` y al QR generado.

## Global Constraints

- **Base de datos:**
  - NUNCA correr `prisma db push`, `prisma migrate`, `db:seed` ni nada que toque la base: el `.env` local es producción.
  - Solo `npx prisma generate`.
  - El SQL lo corre una persona del equipo.
- Sin `any` en TypeScript.
- Copy en español con voseo ("agregá", "mostrá", "activala"), tal cual en los artboards.
- Montos en centavos enteros (`Int`). Precio: `1000` (= $10.00).
- Evento:
  - slug `villains-ball`, nombre `The Villains Ball`
  - `startsAt` = `2026-10-31T00:30:00Z`, `endsAt` = `2026-10-31T05:59:00Z`
  - lugar `Plaza Presidente · Nivel 3 · San Salvador`
  - `capacity` = null
- Pedido:
  - 1–6 entradas
  - vence 24 h después de crearse
  - código `HW-` + 4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- Tokens: `randomBytes(32).toString('hex')`.
- Banco: Banco Cuscatlán, cuenta corriente `152301000036454`, titular `The Wellnest`.
- WhatsApp del estudio: `+50377923957`.
- URL base: `process.env.NEXTAUTH_URL ?? 'https://wellneststudio.net'`.
- Zona horaria de display: `America/El_Salvador`.
- Rutas admin: verificación inline `getServerSession(authOptions)` + `session.user?.role === 'ADMIN'`, si no responde 401 `{ error: 'No autorizado' }` (patrón del repo).
- Paleta del evento:
  - fondo `#0D0908`, crema `#EFE6D6`, carmesí `#8E1A24`
  - carmesí sobre oscuro `#D0464F`
  - texto secundario `#CDBFA8` / `#4A3B32`, borde `#8C7A6B`
  - verde admitido `#1E5A3A`, rojo rechazo `#4A0D13`
- Fuentes del evento: Cinzel (500–700), Cormorant Garamond (500–700 + itálica 500–600), Playfair Display (400/600 + itálica 400/500), con `next/font/google`.
- Tests: `npx vitest run <ruta>`. Typecheck: `npx tsc --noEmit`. Lint: `npm run lint`.
- `scripts/` está fuera de tsconfig: correr los scripts nuevos para validarlos.
- Commits con la línea `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Teléfonos escritos de cualquier forma** (`7792-3957`, `+503 7792 3957`, `503 77923957`, `(503) 7792-3957`) se normalizan al mismo `+50377923957`; un número de otro país con `+` se respeta. → Test en Task 2.
2. **Nombres con `<`, `&`, comillas o emojis** no rompen los correos (HTML escapado) ni el enlace de WhatsApp (`encodeURIComponent`). → Tests en Tasks 3 y 6.
3. **Correo ya registrado con otra capitalización** (`Ana@Gmail.com` vs `ana@gmail.com`): se vincula a la cuenta existente y no se toca su nombre ni su contraseña. → Test en Task 4.
4. **Dos admins confirman el mismo pedido a la vez:** solo se crean las entradas una vez; el segundo recibe "Ya estaba confirmado". → Test en Task 6.
5. **El escáner entrega variantes de la URL** (con `/` final, `?utm=…`, `http://`, otro dominio o texto basura): se extrae el token o se responde "QR no reconocido", nunca un 500. → Test en Task 10.

---

## Fase 1: venta, confirmación y entrada (para abrir la venta)

### Task 1: Tablas, modelos de Prisma y configuración del evento

**Files:**
- Create: `prisma/sql/2026-10-22-event-tickets.sql`
- Modify: `prisma/schema.prisma` (agregar al final)
- Create: `src/lib/events/config.ts`

**Interfaces:**
- Produces:
  - Modelos Prisma `Event`, `EventOrder`, `EventTicket` y enum `EventOrderStatus { PENDING PAID CANCELLED }`, con los campos del spec ("Modelo de datos"). Sin relaciones a `User`: `buyerUserId`, `holderUserId`, `confirmedById`, `checkedInById` son `String?` sueltos.
  - Relaciones: `Event 1–n EventOrder`, `Event 1–n EventTicket`, `EventOrder 1–n EventTicket`, con `onDelete: Cascade`.
  - `EventTicket` tiene `@@unique([orderId, seq])` y, además de los campos del spec, `marketingOptIn Boolean @default(false)` (el spec dice que vive en el pedido y en la entrada). La entrada 1 lo copia del pedido al confirmar; las demás lo toman del formulario de reclamar.
  - `src/lib/events/config.ts` exporta:
    - `VILLAINS_BALL_SLUG = 'villains-ball'`
    - `EVENT_ORDER_MAX_QTY = 6`
    - `EVENT_ORDER_HOLD_HOURS = 24`
    - `EVENT_BANK = { name: 'Banco Cuscatlán', accountType: 'Cuenta corriente', account: '152301000036454', holder: 'The Wellnest' }`
    - `EVENT_STUDIO_WHATSAPP = '+50377923957'`
    - `EVENT_CODE_PREFIX = 'HW-'`
    - `siteUrl(): string`

- [ ] **Step 1: Escribir el SQL**
  - Idempotente: tipo `EventOrderStatus` creado dentro de un `DO $$ ... IF NOT EXISTS` sobre `pg_type`, y `CREATE TABLE IF NOT EXISTS` para `"Event"`, `"EventOrder"` y `"EventTicket"`.
  - Columnas camelCase entre comillas; `TEXT` para ids/strings; `TIMESTAMP(3)` para fechas; `INTEGER`; `BOOLEAN`.
  - Defaults: `createdAt DEFAULT CURRENT_TIMESTAMP`, `status DEFAULT 'PENDING'`, `salesOpen DEFAULT true`, `marketingOptIn DEFAULT true`.
  - Índices: los únicos y normales del spec, más `UNIQUE ("orderId","seq")`.
  - Foreign keys con `ON DELETE CASCADE`.
  - Al final:
    ```sql
    INSERT INTO "Event" ("id","slug","name","startsAt","endsAt","venue","priceCents","capacity","salesOpen")
    VALUES ('evt_villains_ball_2026','villains-ball','The Villains Ball','2026-10-31 00:30:00','2026-10-31 05:59:00','Plaza Presidente · Nivel 3 · San Salvador',1000,NULL,true)
    ON CONFLICT ("slug") DO NOTHING;
    ```
  - El archivo empieza con un comentario: "Correr con POSTGRES_URL (conexión directa). NO usar prisma db push."
  - `updatedAt` en `EventOrder` lleva `NOT NULL DEFAULT CURRENT_TIMESTAMP`. Prisma lo maneja con `@updatedAt`.

- [ ] **Step 2: Agregar los modelos a `schema.prisma`**, con nombres de campo idénticos a las columnas del SQL. `updatedAt DateTime @updatedAt`.

- [ ] **Step 3: Generar el cliente y verificar tipos**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: sin errores. **No correr `db push`.**

- [ ] **Step 4: Escribir `src/lib/events/config.ts`** con las constantes del bloque Interfaces.

- [ ] **Step 5: Commit**
```bash
git add prisma/sql/2026-10-22-event-tickets.sql prisma/schema.prisma src/lib/events/config.ts
git commit -m "feat(evento): tablas Event/EventOrder/EventTicket y configuración de The Villains Ball"
```

### Task 2: Códigos, tokens y teléfonos (funciones puras)

**Files:**
- Create: `src/lib/events/codes.ts`, `src/lib/events/phone.ts`
- Test: `src/lib/events/codes.test.ts`, `src/lib/events/phone.test.ts`

**Interfaces:**
- Produces:
  - `generateOrderCode(random?: (n: number) => Buffer): string`: formato `HW-XXXX`.
  - `generateToken(): string`: 64 caracteres hex.
  - `ticketLabel(orderCode: string, seq: number): string`: `ticketLabel('HW-7K3P', 1) === 'HW-7K3P-1'`.
  - `type PhoneResult = { ok: true; e164: string } | { ok: false; error: string }`
  - `normalizePhone(input: string): PhoneResult`
  - `waNumber(e164: string): string`: sin `+`.

- [ ] **Step 1: Tests que fallan**
```ts
it('genera HW- + 4 caracteres del alfabeto sin ambiguos', () => {
  for (let i = 0; i < 200; i++) expect(generateOrderCode()).toMatch(/^HW-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
})
it('token de 64 hex', () => expect(generateToken()).toMatch(/^[0-9a-f]{64}$/))
it('etiqueta de entrada', () => expect(ticketLabel('HW-7K3P', 2)).toBe('HW-7K3P-2'))
it.each(['7792-3957', '77923957', '+503 7792 3957', '503 77923957', '(503) 7792-3957', ' 7792 3957 '])(
  'normaliza %s', (raw) => expect(normalizePhone(raw)).toEqual({ ok: true, e164: '+50377923957' }))
it('acepta 2xxx y 6xxx de SV', () => {
  expect(normalizePhone('2222-3333')).toEqual({ ok: true, e164: '+50322223333' })
  expect(normalizePhone('6123 4567')).toEqual({ ok: true, e164: '+50361234567' })
})
it('respeta números extranjeros con +', () => expect(normalizePhone('+1 (305) 555-0101')).toEqual({ ok: true, e164: '+13055550101' }))
it.each(['1234', '9999-9999', 'abc', '', '+12'])('rechaza %s', (raw) => {
  const r = normalizePhone(raw)
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error).toBe('Escribí tu WhatsApp con código de país si no es de El Salvador')
})
it('waNumber quita el +', () => expect(waNumber('+50377923957')).toBe('50377923957'))
```

- [ ] **Step 2: Correr y ver que fallan** — Run: `npx vitest run src/lib/events/codes.test.ts src/lib/events/phone.test.ts` → FAIL (módulos no existen).

- [ ] **Step 3: Implementar.**
  - Regla de teléfonos: quitar todo lo que no sea dígito o `+`.
  - Si empieza con `+`: 8–15 dígitos después del `+`.
  - Si no: quitar el prefijo `503` cuando queden 11 dígitos; con 8 dígitos que empiezan en 2, 6 o 7 → `+503…`; cualquier otro caso es error.

- [ ] **Step 4: Correr y ver que pasan** (mismo comando) → PASS.

- [ ] **Step 5: Commit** `feat(evento): códigos de pedido, tokens y normalización de teléfonos`

### Task 3: Mensajes y enlaces de WhatsApp, y calendario

**Files:**
- Create: `src/lib/events/whatsapp.ts`, `src/lib/events/ics.ts`
- Test: `src/lib/events/whatsapp.test.ts`, `src/lib/events/ics.test.ts`

**Interfaces:**
- Consumes: `waNumber` (Task 2), `EVENT_STUDIO_WHATSAPP`, `siteUrl` (Task 1)
- Produces:
  - `waLink(text: string, phoneE164?: string): string`: `https://wa.me/<num>?text=<enc>`, o `https://wa.me/?text=<enc>` sin teléfono.
  - `ticketUrl(token: string): string`: `${siteUrl()}/entrada/${token}`.
  - `buyerTicketsMessage(p: { buyerName: string; firstTicketToken: string; quantity: number }): string`
  - `shareTicketMessage(p: { buyerName: string; token: string }): string`
  - `proofMessage(code: string): string`: `Hola, envío el comprobante de mi pedido ${code}`.
  - `buildEventIcs(e: { name: string; startsAt: Date; endsAt: Date; venue: string; url: string }): string`

- [ ] **Step 1: Tests que fallan**
```ts
it('link con teléfono y texto codificado', () =>
  expect(waLink('Hola & <Ana> 🎃', '+50377923957')).toBe('https://wa.me/50377923957?text=' + encodeURIComponent('Hola & <Ana> 🎃')))
it('link sin teléfono', () => expect(waLink('x')).toBe('https://wa.me/?text=x'))
it('mensaje al comprador con 1 entrada', () => {
  const m = buyerTicketsMessage({ buyerName: 'Ana', firstTicketToken: 'abc', quantity: 1 })
  expect(m).toContain('Ana'); expect(m).toContain('/entrada/abc'); expect(m).not.toContain('Pasar invitación')
})
it('mensaje al comprador con 3 entradas menciona pasar invitaciones', () =>
  expect(buyerTicketsMessage({ buyerName: 'Ana', firstTicketToken: 'abc', quantity: 3 })).toContain('Pasar invitación'))
it('comprobante', () => expect(proofMessage('HW-7K3P')).toBe('Hola, envío el comprobante de mi pedido HW-7K3P'))
it('ics válido', () => {
  const ics = buildEventIcs({ name: 'The Villains Ball', startsAt: new Date('2026-10-31T00:30:00Z'), endsAt: new Date('2026-10-31T05:59:00Z'), venue: 'Plaza Presidente · Nivel 3', url: 'https://x/entrada/t' })
  expect(ics).toContain('BEGIN:VCALENDAR'); expect(ics).toContain('DTSTART:20261031T003000Z'); expect(ics).toContain('DTEND:20261031T055900Z')
  expect(ics.split('\r\n').length).toBeGreaterThan(5)
})
```

- [ ] **Step 2: Correr y ver que fallan** — Run: `npx vitest run src/lib/events/whatsapp.test.ts src/lib/events/ics.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** Texto de `buyerTicketsMessage` (exacto, voseo):
```
¡Hola {buyerName}! Tu pago está confirmado. Esta es tu invitación para The Villains Ball (viernes 30 de octubre, 6:30 p. m., Plaza Presidente nivel 3):
{ticketUrl}
```
  Si `quantity > 1`, se agrega la línea `Tus otras {quantity-1} invitaciones están en tu entrada, en el botón «Pasar invitación».`

  `shareTicketMessage`: `{buyerName} te invita a The Villains Ball. Abrí tu invitación y dejá tus datos para recibir tu QR: {ticketUrl}`.

  ICS: líneas con CRLF; escapar `,` `;` y `\` en los textos.

- [ ] **Step 4: Correr y ver que pasan** → PASS.

- [ ] **Step 5: Commit** `feat(evento): mensajes de WhatsApp y calendario .ics`

### Task 4: Cuentas: buscar o crear usuario y correo de "elegir contraseña"

**Files:**
- Create: `src/lib/events/accounts.ts`, `src/lib/auth/passwordSetup.ts`
- Modify:
  - `src/app/api/auth/forgot-password/route.ts:55-104`: usar `passwordSetup`. Así se corrige también el `deleteMany({ where: { token } })` que borraba con el token crudo en vez del hash.
  - `src/app/api/auth/register/route.ts:42-50`
- Test: `src/lib/events/accounts.test.ts`, `src/lib/auth/passwordSetup.test.ts`

**Interfaces:**
- Produces:
  - `type DbClient = Pick<PrismaClient, 'user'>`. Acepta `prisma` o el `tx` de una transacción.
  - `findOrCreateUserByEmail(db: DbClient, p: { name: string; email: string; phone: string }): Promise<{ id: string; created: boolean }>`
  - `sendPasswordSetupEmail(user: { email: string; name: string }, opts?: { subject?: string }): Promise<{ success: boolean }>`: crea el `PasswordResetToken` con hash sha256 y 1 h de vigencia, manda `buildPasswordResetEmail` y, solo si se envió, invalida los tokens previos. Si falla, borra el token nuevo **por su hash**.

- [ ] **Step 1: Tests que fallan** (con Prisma mockeado, patrón `vi.hoisted` de `src/lib/payments/markOrderPaid.test.ts`):
```ts
it('vincula usuario existente sin importar mayúsculas y no lo modifica salvo teléfono vacío', async () => {
  db.user.findFirst.mockResolvedValue({ id: 'u1', phone: null })
  const r = await findOrCreateUserByEmail(db, { name: 'Otro Nombre', email: 'Ana@Gmail.com ', phone: '+50377923957' })
  expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'ana@gmail.com', mode: 'insensitive' } } }))
  expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { phone: '+50377923957' } })
  expect(db.user.create).not.toHaveBeenCalled(); expect(r).toEqual({ id: 'u1', created: false })
})
it('no pisa teléfono existente', async () => { db.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+5032' }); await findOrCreateUserByEmail(db, { name: 'A', email: 'a@b.c', phone: '+50377923957' }); expect(db.user.update).not.toHaveBeenCalled() })
it('crea usuario sin contraseña', async () => {
  db.user.findFirst.mockResolvedValue(null); db.user.create.mockResolvedValue({ id: 'u2' })
  expect(await findOrCreateUserByEmail(db, { name: 'Ana', email: 'ANA@x.com', phone: '+50377923957' })).toEqual({ id: 'u2', created: true })
  expect(db.user.create).toHaveBeenCalledWith({ data: { name: 'Ana', email: 'ana@x.com', phone: '+50377923957', password: null } })
})
it('passwordSetup: guarda hash, no el token crudo; si falla el correo borra por hash', async () => { /* sendEmail mock → {success:false}; expect deleteMany({ where: { token: <hash de 64 hex distinto del token del enlace> } }) */ })
```

- [ ] **Step 2: Correr y ver que fallan** — Run: `npx vitest run src/lib/events/accounts.test.ts src/lib/auth/passwordSetup.test.ts` → FAIL.

- [ ] **Step 3: Implementar** las dos funciones y refactorizar `forgot-password` para que llame a `sendPasswordSetupEmail`, manteniendo sus respuestas actuales.

- [ ] **Step 4: Modificar `register`.** Si el usuario existente tiene `password === null`: llamar a `sendPasswordSetupEmail(user, { subject: 'Elegí tu contraseña - Wellnest' })` y responder **200** `{ message: 'Ya tenés una cuenta creada con tu entrada. Te mandamos un correo para que elijas tu contraseña.', passwordSetupSent: true }`.
  - En `src/app/(auth)/registro/page.tsx`, si llega `passwordSetupSent`, mostrar ese mensaje en lugar de redirigir al login.
  - Si la cuenta tiene contraseña, todo sigue igual.

- [ ] **Step 5: Correr tests + typecheck** — Run: `npx vitest run src/lib && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit** `feat(evento): cuentas por correo y flujo reutilizable para elegir contraseña`

### Task 5: Crear pedido (servicio, API y correo de instrucciones)

**Files:**
- Create:
  - `src/lib/events/orders.ts` (este task agrega `createEventOrder`, `isOrderExpired`, `seatsTaken`)
  - `src/lib/events/emails.ts`
  - `src/app/api/eventos/[slug]/pedidos/route.ts`
- Test: `src/lib/events/orders.test.ts`, `src/lib/events/emails.test.ts`

**Interfaces:**
- Consumes: `generateOrderCode`, `generateToken`, `normalizePhone` (Task 2); config (Task 1); `sendEmail` (`src/lib/emailService.ts`)
- Produces:
  - `isOrderExpired(o: { status: EventOrderStatus; expiresAt: Date }, now: Date): boolean`: true solo si `PENDING` y `expiresAt <= now`.
  - `hasCapacity(capacity: number | null, taken: number, requested: number): boolean`
  - `seatsTaken(db, eventId: string, now: Date): Promise<number>`: suma de `quantity` de los pedidos `PAID` más los `PENDING` con `expiresAt > now`.
  - `const createOrderInput`: schema zod `{ name: string 2–100, phone: string, email: email ≤254, quantity: int 1–6, marketingOptIn: boolean }`.
  - `type CreateOrderResult = { ok: true; accessToken: string; code: string } | { ok: false; status: 400 | 404 | 409; error: string }`
  - `createEventOrder(slug: string, input: CreateOrderInput, now?: Date): Promise<CreateOrderResult>`
  - `escapeHtml(s: string): string`, exportado desde `emails.ts`.
  - `buildPaymentInstructionsEmail(p: { buyerName: string; code: string; amountCents: number; quantity: number; orderUrl: string }): string`

- [ ] **Step 1: Tests que fallan**, con Prisma mockeado:
  - `isOrderExpired`: `PENDING` vencido → true; `PAID` vencido → false.
  - `hasCapacity(null, 999, 6)` → true; `hasCapacity(10, 8, 3)` → false; `hasCapacity(10, 7, 3)` → true.
  - `createEventOrder`:
    - Evento inexistente → `{ ok:false, status:404 }`.
    - `salesOpen=false` o `now >= startsAt` → `{ ok:false, status:409, error:'La venta de entradas está cerrada' }`.
    - Sin cupo → `{ ok:false, status:409, error:'Las entradas se agotaron' }`.
    - Teléfono inválido → `{ ok:false, status:400, error:<mensaje de normalizePhone> }`.
    - Feliz → `create` con `amountCents = 1000*quantity`, `expiresAt = now + 24h`, `buyerEmail` en minúsculas, `buyerPhone` en E.164 y `status` por defecto.
    - Choque del código único (`P2002` con target `code`) → reintenta con otro código, hasta 5 veces.
    - Conflicto de serialización (`P2034`) → reintenta una vez.
  - `buildPaymentInstructionsEmail` con `buyerName: '<b>Ana</b> & Co'` → contiene `&lt;b&gt;Ana&lt;/b&gt; &amp; Co`, el código, `$20.00`, `152301000036454`, `The Wellnest` y la frase `agregá este código en el campo`.

- [ ] **Step 2: Correr y ver que fallan** — Run: `npx vitest run src/lib/events/orders.test.ts src/lib/events/emails.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `createEventOrder` con `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`: leer evento, `seatsTaken`, validar, `create`. Implementar el correo con tablas e inline styles, en la paleta del evento.

- [ ] **Step 4: Ruta `POST /api/eventos/[slug]/pedidos`**
  - `checkRateLimit('evento-pedido:'+requestIp(req), 5, 600_000)` → si se excede, 429 con `{ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }`.
  - Validar el body con `createOrderInput.safeParse` → 400 con el primer error.
  - Llamar a `createEventOrder` y, si sale bien, mandar el correo. Si el correo falla, se registra en `console.error` y no se falla la respuesta.
  - Responder `{ accessToken, code }` con status 201.
  - `params` se tipa `Promise<{ slug: string }>` y se hace `await`.

- [ ] **Step 5: Correr tests + typecheck** → PASS.

- [ ] **Step 6: Commit** `feat(evento): crear pedido con código, cupo y correo de instrucciones de pago`

### Task 6: Confirmar, cancelar y anular pedidos (servicio, API admin, correo de entradas)

**Files:**
- Modify: `src/lib/events/orders.ts`, `src/lib/events/emails.ts`
- Create:
  - `src/app/api/admin/eventos/pedidos/route.ts` (GET)
  - `src/app/api/admin/eventos/pedidos/[id]/confirmar/route.ts`
  - `src/app/api/admin/eventos/pedidos/[id]/cancelar/route.ts`
  - `src/app/api/admin/eventos/pedidos/[id]/whatsapp/route.ts`
  - `src/app/api/admin/eventos/export/route.ts`
- Test: `src/lib/events/orders.test.ts` (ampliar), `src/lib/events/emails.test.ts` (ampliar)

**Interfaces:**
- Consumes: `findOrCreateUserByEmail` (Task 4), `generateToken`/`ticketLabel` (Task 2), `buyerTicketsMessage`/`waLink`/`ticketUrl` (Task 3), `seatsTaken`/`isOrderExpired` (Task 5)
- Produces:
  - `type ConfirmResult = { ok: true; tickets: { seq: number; token: string }[]; overCapacity: boolean; whatsappUrl: string } | { ok: false; status: 404 | 409; error: string }`
  - `confirmEventOrder(orderId: string, adminId: string, now?: Date): Promise<ConfirmResult>`
  - `cancelEventOrder(orderId: string, adminId: string, note: string | null): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 409; error: string }>`. Para `PAID` la nota es obligatoria (400 `'Escribí el motivo de la anulación'`). Para `CANCELLED` → 409.
  - `buildTicketsEmail(p: { buyerName: string; tickets: { label: string; url: string }[] }): string`
  - GET `/api/admin/eventos/pedidos?tab=pendientes|pagados|otros&q=` → `{ orders: AdminOrderRow[]; counts: { paidTickets: number; pendingTickets: number; checkedIn: number; capacity: number | null } }`.
    - `AdminOrderRow` = `{ id, code, buyerName, buyerEmail, buyerPhone, quantity, amountCents, status, expired: boolean, createdAt, paidAt, whatsappSentAt, whatsappUrl: string | null, tickets: { seq, label, holderName, claimed: boolean, checkedInAt }[] }`.
    - `otros` = cancelados más pendientes vencidos.

- [ ] **Step 1: Tests que fallan** para `confirmEventOrder`:
  - **Carrera:** `tx.eventOrder.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PAID', paidAt, confirmedById } })` devuelve `count: 0` → `{ ok:false, status:409, error:'Ya estaba confirmado' }` y **no** se llama `eventTicket.createMany`.
  - **Feliz con quantity 3:** `createMany` con 3 filas seq 1..3 y tokens distintos de 64 hex. La fila 1 lleva `holderName/Email/Phone` del pedido, `claimedAt` y `holderUserId` del usuario. Se actualiza `buyerUserId`. Devuelve `whatsappUrl` que empieza con `https://wa.me/503`.
  - **Vencido + sobre cupo** (capacity 10, taken 10 sin contar este pedido) → confirma igual con `overCapacity: true`.
  - **`cancelEventOrder`:**
    - `PAID` sin nota → 400.
    - `PAID` con nota → `CANCELLED` con `cancelledAt` y `adminNote`.
    - `PENDING` sin nota → ok.
  - **`buildTicketsEmail`:** escapa el nombre e incluye cada URL.

- [ ] **Step 2: Correr y ver que fallan** → FAIL.

- [ ] **Step 3: Implementar.**
  - Todo `confirmEventOrder` va en un `prisma.$transaction`, y la creación de usuario usa el `tx`.
  - El correo de entradas se manda **fuera** de la transacción, desde la ruta.
  - `whatsappUrl = waLink(buyerTicketsMessage(...), order.buyerPhone)`.

- [ ] **Step 4: Rutas admin.**
  - `POST confirmar` → `confirmEventOrder` + `sendEmail(buildTicketsEmail)`, best-effort.
  - `POST cancelar { note?: string }`.
  - `POST whatsapp` → `whatsappSentAt = now`.
  - `GET pedidos`.
  - `GET export` → CSV `text/csv; charset=utf-8` con BOM, separador `,`, de los `PAID`. Columnas: `codigo,comprador,correo,telefono,cantidad,monto,pagado_el,confirmado_por`. `monto` en dólares con 2 decimales; `pagado_el` en hora de El Salvador; `confirmado_por` = nombre del admin, buscado por id.
  - Todas con verificación ADMIN inline.

- [ ] **Step 5: Correr tests + typecheck** → PASS.

- [ ] **Step 6: Commit** `feat(evento): confirmar/cancelar/anular pedidos y API del admin`

### Task 7: Layout del evento y página de compra `/halloween` (A1)

**Files:**
- Create:
  - `src/app/(evento)/layout.tsx`: fuentes como variables CSS `--font-cinzel`, `--font-cormorant`, `--font-playfair`; fondo `#0D0908`; contenedor centrado `max-w-[440px]`.
  - `src/app/(evento)/halloween/page.tsx` (server)
  - `src/components/evento/Ornament.tsx` (flor de lis y divisor)
  - `src/components/evento/WaxSeal.tsx` (prop `broken?: boolean`; SVG de A3)
  - `src/components/evento/BuyForm.tsx` (client)
- Modify: `src/components/layout/Navbar.tsx:29` y `src/components/layout/Footer.tsx:39`. Ocultar también cuando `pathname` empieza con `/halloween` o `/entrada`.
- Test: ninguno nuevo (UI). Verificación manual abajo.

**Interfaces:**
- Consumes: `POST /api/eventos/villains-ball/pedidos` (Task 5), `EVENT_ORDER_MAX_QTY`
- Produces: `WaxSeal`, `Ornament` y las variables de fuente del layout, reutilizados en Tasks 8, 9 y 11.

- [ ] **Step 1: Layout y componentes de ornamento**, con los SVG copiados de `A1-compra.html` y `A3-entrada.html`.

- [ ] **Step 2: Página `/halloween`** igual a `A1-compra.html`:
  - Hero con `next/image` de `/halloween/invitacion.jpg` (`object-position: center 38%`, alto 300, degradado inferior) y tarjeta crema montada a −64 px.
  - `metadata` con título "The Villains Ball · Wellnest".
  - Si la venta está cerrada (`!salesOpen` o `now >= startsAt`), mostrar en la tarjeta "La venta de entradas está cerrada" en lugar del formulario.

- [ ] **Step 3: `BuyForm`.**
  - Inputs con `<label>`; el stepper va de 1 a 6; el botón muestra `CONTINUAR · $<total>`; la casilla de novedades viene marcada.
  - Al enviar: deshabilitar el botón, hacer el POST y luego `router.push('/halloween/pedido/'+accessToken)`.
  - Si hay error, mostrarlo arriba del botón en `#8E1A24`.
  - Validación de cliente con el mismo `createOrderInput` (Task 5).

- [ ] **Step 4: Verificar.**
  - Run: `npx tsc --noEmit && npm run lint` → sin errores.
  - Luego `npm run dev` y abrir `/halloween` a 390 px: se ve como A1 y no aparecen Navbar ni Footer.
  - **No enviar el formulario en local:** escribiría en producción.

- [ ] **Step 5: Commit** `feat(evento): layout del evento y página de compra /halloween`

### Task 8: Página del pedido `/halloween/pedido/[accessToken]` (A2)

**Files:**
- Create:
  - `src/app/(evento)/halloween/pedido/[accessToken]/page.tsx` (server; `robots: { index: false }`)
  - `src/components/evento/CopyCodeButton.tsx` (client)
- Modify: `src/lib/events/orders.ts` (agregar `getOrderView`)
- Test: `src/lib/events/orders.test.ts` (ampliar)

**Interfaces:**
- Produces: `getOrderView(accessToken: string, now?: Date): Promise<null | { state: 'pending' | 'expired' | 'paid' | 'cancelled'; code: string; quantity: number; amountCents: number; expiresAt: Date; tickets: { label: string; url: string }[] }>`. `tickets` va vacío salvo en `paid`.

- [ ] **Step 1: Test que falla:** pedido `PENDING` vencido → `state: 'expired'`; `PAID` → `tickets` con URLs `/entrada/<token>` ordenadas por `seq`.

- [ ] **Step 2: Correr y ver que falla, implementar, correr y ver que pasa.**

- [ ] **Step 3: Página igual a `A2-pago.html`**, con estos estados:
  - **`pending`:** copy exacto ("Al transferir, agregá este código en el campo **"Concepto"** de tu transferencia:", el código, "Sin este código no podemos identificar tu pago.") y "Copiar código" (`navigator.clipboard.writeText`, que cambia a "COPIADO" por 2 s).
    - Monto y datos de `EVENT_BANK`, incluida la fila "Tipo: Cuenta corriente".
    - Botón "Enviar comprobante por WhatsApp" → `waLink(proofMessage(code), EVENT_STUDIO_WHATSAPP)`.
    - Pasos I–III y "Tus {quantity} lugares quedan apartados por 24 horas." (con 1: "Tu lugar queda apartado por 24 horas.").
  - **`paid`:** "Tu pago está confirmado" y enlaces a cada invitación.
  - **`expired`:** "Tu apartado venció. Si ya transferiste, escribinos por WhatsApp" y el botón de WhatsApp.
  - **`cancelled`:** "Este pedido fue anulado. Escribinos por WhatsApp si tenés dudas."
  - Token inexistente → `notFound()`.

- [ ] **Step 4: Verificar** con `npx tsc --noEmit && npm run lint`. Revisión visual con `npm run dev` solo si hay un pedido real ya creado; no crear datos.

- [ ] **Step 5: Commit** `feat(evento): página de pedido con instrucciones de pago`

### Task 9: Admin `/admin/eventos`

**Files:**
- Create: `src/app/admin/eventos/page.tsx` (client, estilo del admin existente: mismos componentes y clases que `src/app/admin/ventas` o `usuarios`)
- Modify: `src/app/admin/layout.tsx:30-46`. Agregar `{ name: 'Eventos', href: '/admin/eventos', icon: Ticket }` (lucide) después de "Asistencias".

**Interfaces:**
- Consumes: API admin de Task 6.

- [ ] **Step 1: Página.**
  - Contadores (pagadas, pendientes vigentes, adentro, cupo "sin tope").
  - Pestañas Pendientes / Pagados / Otros, búsqueda con debounce de 300 ms y tabla.
  - Pendiente → botón **Confirmar pago**. Abre un diálogo: "¿Viste **$20.00** con concepto **HW-7K3P** en el banco?". Al confirmar:
    - Muestra `overCapacity` como aviso amarillo si aplica.
    - Botón principal **Enviar por WhatsApp**: abre `whatsappUrl` en una pestaña nueva y luego hace POST a `/whatsapp`.
  - Pagado → "Reenviar WhatsApp", "Ver entradas" (lista con estado: sin reclamar / reclamada por X / adentro h:mm) y **Anular** (pide nota).
  - Pendiente → **Cancelar** (nota opcional).
  - Botón **Exportar CSV**.
  - Enlaces a "Check-in" y "Lista imprimible" (rutas de la Task 10b; se agregan aquí aunque esas páginas lleguen después).

- [ ] **Step 2: Verificar** con `npx tsc --noEmit && npm run lint`. Abrir `/admin/eventos` en dev con sesión admin: solo lectura, **sin confirmar ni cancelar en local** (es producción).

- [ ] **Step 3: Commit** `feat(evento): panel de pedidos del evento en el admin`

### Task 10a: Página de la entrada `/entrada/[token]` (A3), reclamar y calendario

**Files:**
- Create:
  - `src/lib/events/ticketView.ts`, `src/lib/events/qr.ts`
  - `src/app/(evento)/entrada/[token]/page.tsx` (server; `robots` noindex)
  - `src/components/evento/ClaimForm.tsx`, `src/components/evento/PassInvitations.tsx` (client)
  - `src/app/api/entradas/[token]/reclamar/route.ts`
  - `src/app/api/eventos/[slug]/calendario/route.ts`
- Test: `src/lib/events/ticketView.test.ts`

**Interfaces:**
- Consumes: `findOrCreateUserByEmail` (T4), `normalizePhone` (T2), `buildEventIcs`/`shareTicketMessage`/`waLink`/`ticketUrl` (T3), `WaxSeal`/`Ornament` (T7)
- Produces:
  - `type TicketPhase = 'cancelled' | 'unclaimed' | 'ready' | 'after-attended' | 'after-missed'`
  - `ticketPhase(t: { orderStatus: EventOrderStatus; claimedAt: Date | null; checkedInAt: Date | null }, event: { endsAt: Date }, now: Date): TicketPhase`
    - Prioridad: `cancelled` → si `now > endsAt`: `after-attended` / `after-missed` → `unclaimed` → `ready`.
  - `qrSvg(url: string): Promise<string>`: `QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1A0F0D', light: '#00000000' } })`.
  - `claimTicket(token: string, input: { name: string; phone: string; email: string; marketingOptIn: boolean }): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 409; error: string }>`, en `src/lib/events/orders.ts`.
    - Pedido no `PAID` → 404.
    - Ya reclamada → 409 `'Esta invitación ya fue reclamada'`.
    - Usa `updateMany where claimedAt null`.

- [ ] **Step 1: Tests que fallan** de `ticketPhase`:
  - Las cinco fases.
  - Una entrada `unclaimed` después de `endsAt` → `after-missed`.
  - Cancelado después de `endsAt` → `cancelled`.

  Y de `claimTicket` con mocks: doble reclamo → 409; teléfono inválido → 400.

- [ ] **Step 2: Correr y ver que fallan, implementar, correr y ver que pasan.**

- [ ] **Step 3: Página igual a `A3-entrada.html`** (fases `ready` y `unclaimed`; las fases `after-*` llegan en Task 11):
  - **Fase `ready`:**
    - "INVITACIÓN k DE N", tarjeta crema, `WaxSeal broken` con animación de 600 ms (CSS, `@media (prefers-reduced-motion: reduce)` sin animación).
    - "THE SOUL HUB TE ESPERA", nombre del titular (o "Invitado de {comprador}" si no hay `holderName`), "THE VILLAINS BALL".
    - QR (`qrSvg(ticketUrl(token))` inline con `dangerouslySetInnerHTML`; el SVG lo genera el servidor), fecha, lugar y "ADMITE A UNA PERSONA · {label}".
  - **Seq 1 con N > 1:** `PassInvitations` con la lista de 2..N. Cada una con el estado (sin reclamar / reclamada por {holderName}) y "Enviar por WhatsApp" → `waLink(shareTicketMessage(...))`, sin teléfono.
  - **Botones:** "Agregar al calendario" → `/api/eventos/villains-ball/calendario` y pie "Mostrá esta invitación en la puerta. Es personal y solo se usa una vez."
  - **Fase `unclaimed`:** tarjeta sellada sin QR, "Esta invitación es para vos. Dejanos tus datos" y `ClaimForm`. Al enviar: `router.refresh()`.
  - **Fase `cancelled`:** "Esta invitación fue anulada".
  - Token inexistente → `notFound()`.

- [ ] **Step 4: Rutas.**
  - `POST reclamar`: rate limit 10 por 10 min por IP; valida con zod; llama a `claimTicket`.
  - `GET calendario`: `text/calendar; charset=utf-8` con `Content-Disposition: attachment; filename="the-villains-ball.ics"`.

- [ ] **Step 5: Correr tests + `npx tsc --noEmit && npm run lint`** → PASS.

- [ ] **Step 6: Commit** `feat(evento): página de la entrada con QR, reclamar invitación y calendario`

### Puesta en producción de la Fase 1 (persona del equipo, no el agente)

1. Hacer merge del PR #58.
2. Correr `prisma/sql/2026-10-22-event-tickets.sql` contra producción con `POSTGRES_URL`.
3. Abrir el PR de esta rama, hacer merge y deploy.
4. Hacer una compra de prueba real ($10), confirmarla en el admin, abrir la entrada y anularla.

---

## Fase 2: puerta (lista antes del 29-oct)

### Task 10b: Check-in, búsqueda, deshacer y lista imprimible (A4)

**Files:**
- Create:
  - `src/lib/events/checkin.ts`
  - `src/app/api/admin/eventos/checkin/route.ts` (POST y DELETE)
  - `src/app/api/admin/eventos/buscar/route.ts`
  - `src/app/admin/eventos/checkin/page.tsx`, `src/app/admin/eventos/lista/page.tsx`
- Test: `src/lib/events/checkin.test.ts`

**Interfaces:**
- Consumes: `QRScanner` (`{ onScan(result: string), onError?, isActive }`), `ticketLabel` (T2)
- Produces:
  - `extractTicketToken(scanned: string): string | null`: acepta 64 hex sueltos o cualquier URL cuyo path termine en `/entrada/<64 hex>` (con o sin `/` final o query). Cualquier otra cosa → null.
  - `type CheckInResult = { kind: 'admitted' | 'already' | 'unknown' | 'cancelled'; ticketId?: string; holderLabel?: string; label?: string; seq?: number; quantity?: number; checkedInAt?: Date }`
  - `checkInTicket(ref: { token: string } | { ticketId: string }, adminId: string, now?: Date): Promise<CheckInResult>`
    - `holderLabel` = `holderName` o `'Invitado de ' + buyerName`.
    - Orden de verificación: inexistente → `unknown`; pedido `CANCELLED` → `cancelled`; `updateMany({ where: { id, checkedInAt: null }, data: { checkedInAt: now, checkedInById: adminId } })` con count 1 → `admitted`, con 0 → `already` y su `checkedInAt`.
  - `undoCheckIn(ticketId: string, now?: Date): Promise<boolean>`: solo si `checkedInAt` tiene menos de 30 s.
  - `searchTickets(q: string): Promise<{ ticketId; label; holderLabel; buyerName; buyerPhone; checkedInAt }[]>`: por código, nombre del titular o comprador, o teléfono (dígitos), solo de pedidos `PAID`, máximo 20.

- [ ] **Step 1: Tests que fallan.**
  - `extractTicketToken` con:
    - `https://wellneststudio.net/entrada/<hex>`
    - `…/<hex>/`
    - `…/<hex>?utm=1`
    - `http://localhost:3000/entrada/<hex>`
    - `<hex>` suelto (→ token)
    - `https://otro.com/x`, `hola`, `''` y `…/entrada/123` (→ null)
  - `checkInTicket`:
    - Doble escaneo: el segundo `updateMany` devuelve 0 → `already` con la hora del primero.
    - Cancelado → `cancelled` sin llamar `updateMany`.
    - Desconocido → `unknown`.
  - `undoCheckIn` a los 31 s → false.

- [ ] **Step 2: Correr y ver que fallan, implementar, correr y ver que pasan.**

- [ ] **Step 3: API.**
  - `POST /api/admin/eventos/checkin { scanned?: string; ticketId?: string }`: con `scanned`, `extractTicketToken`; si da null → `{ kind: 'unknown' }`.
  - `DELETE { ticketId }` → `undoCheckIn`.
  - `GET buscar?q=`.
  - Todas responden 200 con el resultado (no 4xx para los rechazos, que son resultados normales), y verifican ADMIN.

- [ ] **Step 4: Página `/admin/eventos/checkin`** igual a `A4-checkin.html`:
  - Encabezado "PUERTA · The Villains Ball" con "N adentro", que se refresca tras cada check-in.
  - `QRScanner` activo mientras no hay resultado en pantalla.
  - Resultados:
    - `admitted`: panel verde, **"ADMITIDO"** (siempre en masculino: no se guarda el género), `holderLabel`, "Invitación k de N · label" y "Pago confirmado por transferencia". Botón "ESCANEAR SIGUIENTE" y enlace "Deshacer" durante 30 s.
    - `already`: panel rojo "YA INGRESÓ · h:mm p. m." (hora de El Salvador) con nombre y label.
    - `unknown`: rojo "QR NO RECONOCIDO".
    - `cancelled`: rojo "INVITACIÓN ANULADA".
  - "Buscar por nombre o teléfono": input y resultados, cada uno con "Admitir" (POST con `ticketId`) o con su hora de ingreso.

- [ ] **Step 5: Página `/admin/eventos/lista`**, para imprimir.
  - Tabla de entradas de pedidos `PAID` ordenadas por nombre del comprador. Columnas: casilla vacía, comprador, titular, label, teléfono.
  - CSS `@media print` que oculta la barra del admin.
  - Botón "Imprimir" (`window.print()`).

- [ ] **Step 6: Correr tests + `npx tsc --noEmit && npm run lint`** → PASS. Abrir `/admin/eventos/checkin` en dev en el celular (misma red, `npm run dev -- -H 0.0.0.0`) para ver la cámara, **sin escanear entradas reales**.

- [ ] **Step 7: Commit** `feat(evento): check-in en la puerta, búsqueda y lista imprimible`

---

## Fase 3: después del show (lista el 31-oct)

### Task 11: Carta de después del show (A5), activar cuenta y correo de agradecimiento

**Files:**
- Modify: `src/app/(evento)/entrada/[token]/page.tsx` (fases `after-*`), `src/lib/events/emails.ts`
- Create:
  - `src/components/evento/ActivateButton.tsx` (client)
  - `src/app/api/entradas/[token]/activar/route.ts`
  - `scripts/send-villains-ball-thanks.ts`
- Test: `src/lib/events/activate.test.ts`, `src/lib/events/emails.test.ts` (ampliar)

**Interfaces:**
- Consumes: `sendPasswordSetupEmail` (T4), `ticketPhase` (T10a)
- Produces:
  - `activateFromTicket(token: string): Promise<{ result: 'email-sent'; maskedEmail: string } | { result: 'has-password' } | { result: 'unclaimed' } | { result: 'not-found' }>`, en `src/lib/events/activate.ts`.
  - `maskEmail('ana.martinez@gmail.com') === 'a***@gmail.com'`
  - `buildThanksEmail(p: { name: string; ticketUrl: string }): string`

- [ ] **Step 1: Tests que fallan.**
  - Titular sin contraseña → llama a `sendPasswordSetupEmail` con el correo del usuario titular y `subject: 'Activá tu cuenta - Wellnest'`; devuelve `email-sent` con el correo enmascarado.
  - Con contraseña → `has-password` sin enviar.
  - Sin reclamar → `unclaimed`.
  - `maskEmail`.
  - `buildThanksEmail` escapa el nombre.

- [ ] **Step 2: Correr y ver que fallan, implementar, correr y ver que pasan.**

- [ ] **Step 3: Página, fases `after-*`,** igual a `A5-despues.html`:
  - Hero `/halloween/aro-sombra.jpg` con "31 DE OCTUBRE · LA MAÑANA SIGUIENTE".
  - `after-attended`: "Gracias por venir, *{primer nombre}*.".
  - `after-missed`: "La función terminó, *{primer nombre}*.".
  - Textos exactos: "Fue un honor tenerte en The Villains Ball. Lo que viste en escena se entrena en Wellnest: pole, aro y tela." (en `after-missed` la primera frase se omite) y "Tu cuenta ya está creada. Activala para ver los paquetes y reservar tus clases."
  - `ActivateButton` "ACTIVAR MI CUENTA" + "Solo elegís una contraseña.":
    - `email-sent` → "Te mandamos un correo a {masked} para que elijas tu contraseña."
    - `has-password` → `router.push('/login')`
    - `unclaimed` → mostrar `ClaimForm` y luego reintentar.
  - Pie: "Esta es la misma invitación que mostraste en la puerta: después del show se convierte en esta carta." (solo en `after-attended`).

- [ ] **Step 4: Ruta `POST activar`.** Rate limit 5 por 15 min por IP; devuelve el resultado de `activateFromTicket`.

- [ ] **Step 5: Script.** `scripts/send-villains-ball-thanks.ts`:
  - `import './loadEnv'` en la primera línea.
  - Por defecto `--dry-run`: lista los destinatarios (titulares con correo y `checkedInAt` no nulo, sin repetir correo) y no envía nada. Con `--send` envía `buildThanksEmail` con asunto "Gracias por venir a The Villains Ball", uno cada 500 ms, y resume enviados y fallidos.
  - Validarlo corriendo `npx tsx scripts/send-villains-ball-thanks.ts` (dry-run; solo lee).

- [ ] **Step 6: Correr tests + `npx tsc --noEmit && npm run lint`** → PASS.

- [ ] **Step 7: Commit** `feat(evento): carta de después del show, activar cuenta y correo de agradecimiento`
