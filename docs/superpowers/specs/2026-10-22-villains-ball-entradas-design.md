# The Villains Ball: entradas por transferencia con QR

Fecha: 2026-10-22 · Evento: viernes 30 de octubre de 2026, 6:30 p. m., Plaza Presidente nivel 3, San Salvador · Entrada general: $10

Diseño visual aprobado: propuesta A, "La invitación sellada", con los cambios de los comentarios del 22-oct. Lienzo: https://claude.ai/artifact/L6E4QUwoycG7an3UvPfWnf (pantallas A1–A5; las B y C se descartaron).

## Por qué

Wellnest organiza un show de Halloween con entrada pagada. Solo se cobra por transferencia bancaria. Se necesita:

1. Saber con certeza quién pagó, sin adivinar.
2. Darle a cada asistente una entrada con QR que llegue por WhatsApp.
3. Controlar la puerta: cada entrada sirve una sola vez.
4. Que cada asistente quede como usuario de Wellnest y se pueda contactar después.

La marca del evento ya existe en redes: cine noir, terciopelo rojo, sello de lacre, flor de lis, serif crema con cursivas carmesí. Las páginas públicas del evento deben verse como esos posts, no como el resto del sitio.

## Metas

- Página pública de compra (`/halloween`), con código de referencia único por pedido.
- Panel en el admin para confirmar pagos contra el banco.
- Al confirmar: se crean las entradas y la cuenta del comprador, y se entrega todo por WhatsApp (enlace `wa.me` con el mensaje ya escrito) y por correo.
- Una entrada (y un QR) por persona. El comprador pasa las demás a sus acompañantes, que dejan sus datos para "reclamar" la suya.
- Check-in en la puerta desde el celular, con QR de un solo uso y búsqueda manual.
- Después del show, la misma página de la entrada se convierte en una carta de agradecimiento con "Activar mi cuenta".

## Fuera de alcance

- API oficial de WhatsApp Business: el envío es manual, con un clic del admin.
- Pagos con tarjeta o PayWay para este evento.
- Subir el comprobante a la plataforma: no hay almacenamiento de archivos (no hay Vercel Blob). Se reemplaza por un botón para mandarlo por WhatsApp al estudio.
- Cruce automático con el estado de cuenta del banco.
- Clase de cortesía o regalo después del show: se eliminó por decisión del negocio.
- Sistema genérico de eventos con su propio admin para crear eventos. Se modela un `Event` para no amarrar el código, pero el evento se crea con SQL.

## Lo que no debe pasar (anti-metas)

- **Confirmar un pago sin verlo en el banco.** El sistema nunca marca un pedido como pagado por sí solo.
- **Que alguien entre dos veces con el mismo QR**, aunque dos celulares escaneen al mismo tiempo. El check-in es atómico.
- **Exponer datos de otros compradores** adivinando códigos. El código corto (`HW-7K3P`) sirve para la transferencia; las URLs usan tokens largos aleatorios.
- **Tocar la base de producción desde la herramienta.** Ver "Base de datos".
- **Que una cuenta existente con contraseña cambie de dueño** porque alguien compró una entrada con ese correo.
- **Ensuciar los reportes de ventas.** Los ingresos del evento no se registran como `Purchase` ni como `Order`.

## Restricciones

- **Plazo:** la venta debe abrir lo antes posible (objetivo: 23–24 oct). El check-in debe estar listo el 29 de octubre y la carta de después del show el 31.
- **Stack:** Next.js 14 App Router, Prisma 5, Postgres (Prisma Postgres), NextAuth credentials con JWT, Vercel. Tests con vitest (`src/**/*.test.ts`).
- **Base de datos (crítico):**
  - **No correr `prisma db push`**: borra un índice único parcial hecho a mano en producción (`Purchase_gateway_provider_id_key`).
  - No hay carpeta de migraciones.
  - Las tablas nuevas se crean con un archivo SQL escrito a mano que **corre una persona del equipo** contra producción usando la conexión directa (`POSTGRES_URL`). `DATABASE_URL` es Accelerate y rechaza DDL según la experiencia del equipo; en cualquier caso el DDL va por `POSTGRES_URL`.
  - El agente solo corre `prisma generate`.
  - El `.env` local apunta a producción: los tests no deben tocar la base (usar mocks, como `src/lib/payments/markOrderPaid.test.ts`).
- **Idioma de la interfaz:** español con voseo, como los posts ("agregá", "mostrá", "activala").
- **Sin `any`** en TypeScript (regla del repo).
- **Pantallas pensadas para celular** (390 px). En escritorio, la columna se centra con ancho máximo de unos 440 px sobre el fondo oscuro.

## Modelo de datos (tablas nuevas)

Los montos se guardan como enteros en centavos, para no heredar el problema de `Float` que tiene pendiente el resto del esquema.

`Event`
- `id`, `slug` (único, `villains-ball`), `name`
- `startsAt` y `endsAt` (UTC). Valores: `startsAt` = 30-oct 6:30 p. m. hora SV (2026-10-31T00:30:00Z); `endsAt` = 30-oct 11:59 p. m. hora SV (2026-10-31T05:59:00Z). La carta de A5 aparece desde la medianoche.
- `venue`, `priceCents` (1000), `capacity` (entero, nulo = sin tope)
- `salesOpen` (boolean), `createdAt`

`EventOrder`
- `id`, `eventId`
- `code`: único, formato `HW-XXXX`, 4 caracteres de un alfabeto sin ambigüedades (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), con reintento si choca
- `accessToken`: único, 32 bytes aleatorios en hex; da acceso a la página del pedido
- `buyerName`, `buyerEmail` (normalizado a minúsculas), `buyerPhone` (normalizado E.164, ver abajo)
- `quantity` (1–6), `amountCents`
- `status`: `PENDING | PAID | CANCELLED`
- `marketingOptIn` (boolean)
- `expiresAt` (`createdAt` + 24 h)
- `paidAt`, `confirmedById` (admin)
- `cancelledAt`, `adminNote`
- `whatsappSentAt`
- `buyerUserId` (se llena al confirmar)
- `createdAt`, `updatedAt`

`EventTicket`
- `id`, `orderId`, `eventId`
- `seq`: 1..quantity; la entrada 1 es del comprador
- `token`: único, 32 bytes aleatorios en hex; va en la URL y en el QR
- `holderName`, `holderEmail`, `holderPhone`, `holderUserId`, `claimedAt`
- `checkedInAt`, `checkedInById`
- `createdAt`

Índices:
- Únicos: `EventOrder(code)`, `EventOrder(accessToken)`, `EventTicket(token)`
- Normales: `EventOrder(eventId, status)`, `EventTicket(eventId, checkedInAt)`

Archivo: `prisma/sql/2026-10-22-event-tickets.sql`, idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE TYPE` dentro de un bloque `DO` que revisa si ya existe). Incluye el `INSERT` del evento "The Villains Ball" con `ON CONFLICT (slug) DO NOTHING`. Los mismos modelos se agregan a `schema.prisma` para que el cliente los conozca, con los nombres de tabla y columna exactos del SQL.

**Cupo:** se considera ocupado por las entradas de pedidos `PAID` más las de pedidos `PENDING` que no han vencido. Si `capacity` es nulo, no hay tope. Al crear un pedido se valida en una transacción con nivel `Serializable`. Si falla por conflicto, se reintenta una vez.

**Vencimiento:** se calcula al leer (`PENDING` con `expiresAt < now` cuenta como vencido); no hay cron.
- El admin sí puede confirmar un pedido vencido, porque la transferencia pudo llegar tarde. Si eso deja el evento por encima del cupo, se muestra una advertencia, pero no se bloquea.

## Flujo y pantallas

### 1. Compra: `/halloween` (A1)

- Hero con la foto de la invitación sobre la bandeja. La tarjeta crema del formulario se monta encima, como en A1.
- Campos: nombre completo, WhatsApp, correo, cantidad (1–6, $10 c/u, total en vivo) y la casilla "Quiero enterarme de las clases y eventos de Wellnest" (marcada por defecto).
- Validación con zod en cliente y servidor.
- `POST /api/eventos/villains-ball/pedidos`:
  - Rate limit de 5 por 10 minutos por IP.
  - Rechaza si `salesOpen` es falso, si ya pasó `startsAt` o si no hay cupo ("Las entradas se agotaron").
  - Crea el pedido `PENDING` y responde con el `accessToken`.
- El cliente redirige a `/halloween/pedido/[accessToken]`.
- Se manda un correo con las instrucciones de pago (código, monto, datos bancarios y el enlace a la página del pedido), para que no dependa de que guarden la página. Si el correo falla, el pedido se crea igual.

### 2. Pago: `/halloween/pedido/[accessToken]` (A2)

- Muestra "Tu invitación espera su sello" con:
  - El texto exacto aprobado: "Al transferir, agregá este código en el campo **"Concepto"** de tu transferencia:"
  - El código grande, con el botón "Copiar código" (`navigator.clipboard`).
  - "Sin este código no podemos identificar tu pago."
- Monto total y datos bancarios: Banco Cuscatlán, cuenta corriente 152301000036454, titular The Wellnest. No son secretos: viven en una constante de configuración del evento (`src/lib/events/villainsBall.ts`), junto con el WhatsApp del estudio.
- En lugar de "Subir comprobante", un botón "Enviar comprobante por WhatsApp". Abre `wa.me/50377923957` (WhatsApp del estudio: +503 7792-3957) con el texto "Hola, envío el comprobante de mi pedido HW-7K3P".
- Los tres pasos I–II–III y la nota "Tus N lugares quedan apartados por 24 horas".
- Según el estado del pedido:
  - Si ya está `PAID`: muestra los enlaces a sus entradas.
  - Si está vencido o `CANCELLED`: muestra un mensaje y el WhatsApp del estudio.

### 3. Admin: `/admin/eventos` (nuevo, con el estilo del admin existente)

- Agregar "Eventos" al arreglo `navigation` de `src/app/admin/layout.tsx`.
- Lista de pedidos del evento:
  - Pestañas: Pendientes / Pagados / Vencidos y cancelados.
  - Búsqueda por código, nombre, teléfono o correo.
  - Columnas: código, comprador, cantidad, monto, fecha, estado.
- Contadores arriba: pagadas, pendientes vigentes, adentro (check-in) y cupo.
- **Confirmar pago** (diálogo que muestra código y monto: "¿Viste $20.00 con concepto HW-7K3P en el banco?") llama a `POST /api/admin/eventos/pedidos/[id]/confirmar`. En una transacción:
  1. Pone el pedido en `PAID` con `paidAt` y `confirmedById`.
  2. Crea `quantity` entradas con tokens aleatorios. La entrada 1 queda reclamada por el comprador (`holderName/Email/Phone` del pedido, `claimedAt` = ahora).
  3. Busca o crea el usuario del comprador (ver "Cuentas").
  4. Llena `buyerUserId` y `holderUserId` de la entrada 1.

  Si dos admins confirman a la vez, solo uno gana: `updateMany where status = PENDING`, y el otro recibe un 409 que dice "Ya estaba confirmado".
- Después de confirmar se manda el correo con los enlaces de las entradas; si falla, se registra pero no revierte nada. El diálogo cambia a:
  - Botón principal **"Enviar por WhatsApp"**: `https://wa.me/<telefono sin +>?text=<mensaje>`. El mensaje incluye el nombre, el enlace de la entrada 1 y, si compró más de una, una línea "Tus otras invitaciones están en tu entrada, en el botón «Pasar invitación»". Al hacer clic se guarda `whatsappSentAt`.
- Fila de un pedido pagado: botones "Reenviar WhatsApp" y "Ver entradas" (con estado de cada una: sin reclamar, reclamada, adentro).
- Pedido pendiente: botón **Cancelar**, con nota opcional.
- Pedido pagado: botón **Anular** (por error o reembolso), con nota obligatoria. Pasa a `CANCELLED`; sus entradas dejan de servir en la puerta y su página dice "Esta invitación fue anulada". Las cuentas ya creadas se quedan.
- **Exportar CSV de pagados** (código, comprador, correo, teléfono, cantidad, monto, fecha de pago, quién confirmó), para la conciliación bancaria del mes.
- Todas las rutas `/api/admin/eventos/*` verifican sesión ADMIN con el mismo patrón inline del resto del admin.

### 4. Entrada: `/entrada/[token]` (A3)

- Pública; el token es el secreto.
- Tarjeta crema con:
  - El sello de lacre roto encima. Al abrir la página por primera vez, una animación corta de unos 600 ms rompe el sello; respeta `prefers-reduced-motion`.
  - "THE SOUL HUB TE ESPERA", el nombre del titular en cursiva carmesí y "THE VILLAINS BALL".
  - El QR, la fecha y el lugar, y "ADMITE A UNA PERSONA · HW-7K3P-1".
- **El QR codifica la URL completa** `https://wellneststudio.net/entrada/<token>`. Si alguien lo escanea con la cámara del teléfono ve su entrada; el escáner del staff extrae el token de la URL. Se genera en el servidor como SVG con la librería `qrcode`, que ya es dependencia.
- **Entrada del comprador (seq 1) con más entradas en el pedido:** botón "Pasar la otra invitación" (o "Pasar invitaciones (N)"). Abre una lista de las entradas 2..N; cada una tiene "Enviar por WhatsApp", que abre `https://wa.me/?text=` con el enlace, y un estado (sin reclamar / reclamada por X). Solo la página de la entrada 1 muestra esa lista.
- **Entrada sin reclamar (seq > 1):** muestra la invitación sellada **sin QR** y el formulario "Esta invitación es para vos. Dejanos tus datos": nombre, WhatsApp, correo y la casilla de novedades.
  - `POST /api/entradas/[token]/reclamar` llena los datos del titular, busca o crea su usuario y muestra el QR.
  - Una entrada reclamada no se puede volver a reclamar.
- **El QR aparece solo después de reclamar** (toma unos 20 segundos y se hace antes de llegar). Si alguien llega a la puerta con una invitación sin reclamar, puede reclamarla ahí mismo desde su celular, o el staff la busca por el nombre del comprador y la admite como "Invitado de <comprador>". Captar los datos de cada asistente es parte de la meta.
- Botón "Agregar al calendario": descarga un `.ics` desde `GET /api/eventos/villains-ball/calendario`.
- Pie: "Mostrá esta invitación en la puerta. Es personal y solo se usa una vez."
- Si el pedido está `CANCELLED`, la entrada muestra "Esta invitación fue anulada" y no tiene QR.

### 5. Check-in: `/admin/eventos/checkin` (A4)

- Página pensada para celular, con el estilo oscuro de A4, dentro del admin (requiere ADMIN).
- Usa el componente existente `QRScanner` (`@yudiel/react-qr-scanner`).
- `POST /api/admin/eventos/checkin { token }`. Acepta el token suelto o la URL completa y extrae el token.
  - **Es atómico:** `updateMany({ where: { token, checkedInAt: null }, data: { checkedInAt: now, checkedInById } })`.
  - count = 1 → **ADMITIDA/O** en verde: nombre del titular (o "Invitado de X"), "Invitación k de N · código-k", "Pago confirmado por transferencia".
  - count = 0 y la entrada existe con `checkedInAt` → **YA INGRESÓ · h:mm p. m.** en rojo. La hora se muestra en America/El_Salvador.
  - Token inexistente → rojo **"QR no reconocido"**.
  - Pedido `CANCELLED` → rojo **"Invitación anulada"**.
  - Los pedidos `PENDING` no tienen entradas, así que no hay caso pendiente.
- El resultado queda en pantalla hasta tocar "Escanear siguiente". `QRScanner` ya ignora el mismo QR durante 3 segundos (`src/components/QRScanner.tsx:22-27`).
- Contador "N adentro" arriba, que se refresca después de cada check-in.
- **Buscar por nombre, teléfono o código**: lista de entradas que coinciden, cada una con "Admitir" (misma API, por id de entrada) y su estado.
- **Lista de invitados imprimible** (`/admin/eventos/lista`): pagados ordenados por apellido, con código, cantidad y casilla para marcar a mano. Sirve de respaldo si falla la señal en el lugar.
- **Deshacer** (solo en el resultado recién mostrado, por 30 s) pone `checkedInAt` en null. Sirve para corregir un escaneo equivocado.

### 6. Después del show: `/entrada/[token]` cuando `now > endsAt` (A5)

- Si la entrada tiene check-in: carta "Gracias por venir, <nombre>." con el texto aprobado:
  - "Fue un honor tenerte en The Villains Ball. Lo que viste en escena se entrena en Wellnest: pole, aro y tela."
  - "Tu cuenta ya está creada. Activala para ver los paquetes y reservar tus clases."
  - Botón **"Activar mi cuenta"** y debajo "Solo elegís una contraseña."
- Si no tiene check-in: la misma carta con "La función terminó" en lugar de "Gracias por venir", y el mismo botón.
- "Activar mi cuenta" llama a `POST /api/entradas/[token]/activar`:
  - Si el usuario titular no tiene contraseña: reutiliza el flujo de "olvidé mi contraseña" (crea el token con hash y manda el correo con el enlace a `/reset-password`). La página muestra "Te mandamos un correo a a***@gmail.com para que elijas tu contraseña".
  - **No** se fija contraseña directo desde el enlace de la entrada: el comprador conoce los enlaces de sus acompañantes y podría tomar sus cuentas.
  - Si el usuario ya tiene contraseña: manda a `/login`.
  - Si la entrada nunca se reclamó: muestra el formulario de reclamar antes de activar.
- **Correo de agradecimiento masivo** (31-oct): script `scripts/send-villains-ball-thanks.ts` que manda el enlace de la entrada a todos los titulares con correo y con check-in.
  - Usa `import './loadEnv'` primero.
  - Tiene modo `--dry-run` por defecto.
  - Lo corre una persona, no un cron.

## Cuentas

- **Buscar o crear un usuario por correo:**
  1. Normaliza a minúsculas y busca sin importar mayúsculas, como hace `register`.
  2. Si existe, lo vincula sin tocar nombre, teléfono ni contraseña. Si no tiene teléfono, se completa con el del pedido.
  3. Si no existe, crea `User { name, email, phone, password: null, role: USER }`.
- Los usuarios sin contraseña no pueden iniciar sesión (`authorize` lo rechaza), lo cual está bien hasta que activen.
- Estos usuarios no tienen compras, así que no afectan los reportes de ventas. Sí suben el contador de "usuarios nuevos del mes" del dashboard (`src/app/admin/page.tsx:94-101`); se acepta.
- **Registro normal de alguien que ya tiene cuenta por su entrada:** hoy `register` responde "Ya existe una cuenta con este email". Se cambia: si la cuenta existente no tiene contraseña, se dispara el correo de "elegir contraseña" (mismo flujo que olvidé mi contraseña) y se responde "Ya tenés una cuenta creada con tu entrada. Te mandamos un correo para que elijas tu contraseña". Las cuentas con contraseña siguen igual.
- `marketingOptIn` vive en el pedido y en la entrada, no en `User`. El usuario no tiene ese campo y no se agrega.

## Teléfono

- Se normaliza a E.164.
  - 8 dígitos que empiezan con 2, 6 o 7 → `+503XXXXXXXX`.
  - Un número que empieza con `+` se respeta.
  - Cualquier otra cosa se rechaza con el mensaje "Escribí tu WhatsApp con código de país si no es de El Salvador".
- Para `wa.me` se usa sin el `+`.
- Va en una función pura con tests.

## Correos (Microsoft Graph, `sendEmail` existente)

1. **Instrucciones de pago** (al crear el pedido).
2. **Tus invitaciones** (al confirmar el pago): un enlace por entrada.
3. **Agradecimiento** (script del 31-oct).

Plantillas HTML con tablas e inline styles, como las existentes, pero con la paleta del evento (fondo `#0D0908`, tarjeta `#EFE6D6`, carmesí `#8E1A24`). Todo dato de usuario se escapa.

## Estilo de las páginas del evento

- Layout propio en `src/app/(evento)/layout.tsx`, o en cada ruta, que:
  - Oculta el Navbar y el Footer del sitio. Hay que extender la condición en `src/components/layout/Navbar.tsx` y `Footer.tsx`, que hoy solo ocultan en `/admin`, para que también oculten `/halloween` y `/entrada`.
  - Carga con `next/font/google` las fuentes Cinzel, Cormorant Garamond y Playfair Display (pesos e itálicas como en los artboards).
- Colores:
  - Fondo `#0D0908`, crema `#EFE6D6`, carmesí `#8E1A24`.
  - Carmesí para títulos en cursiva sobre fondo oscuro: `#D0464F`.
  - Texto secundario `#CDBFA8` y `#4A3B32`; bordes `#8C7A6B`.
  - Verde de admitido `#1E5A3A`; rojo de rechazo `#4A0D13` con borde `#8E1A24`.
- Imágenes: ya están en el repo en `public/halloween/` (recortes de los posts sin texto); usarlas con `next/image`:
  - `invitacion.jpg` (hero A1)
  - `telon.jpg` (fondos A2/A3)
  - `aro-sombra.jpg` (A5)
- Ornamentos (flor de lis, sello de lacre): SVG inline, tomados de los artboards.
- Los artboards son la referencia visual exacta: espaciados, tamaños de letra, textos.

## Seguridad

- Tokens: `crypto.randomBytes(32).toString('hex')`.
- Páginas `/halloween/pedido/*` y `/entrada/*` con `robots: noindex`.
- Rate limit en crear pedido (5 por 10 min por IP), en reclamar (10 por 10 min por IP) y en activar (5 por 15 min por IP), con el `checkRateLimit` existente.
- Las respuestas públicas nunca incluyen correo ni teléfono completos de otros titulares. En la lista "Pasar invitaciones" del comprador solo va el nombre de quien reclamó.

## Tests (vitest, sin base de datos)

Funciones puras con tests:
- Generar código (alfabeto, formato).
- Normalizar teléfono.
- Armar el mensaje y la URL de `wa.me`.
- Calcular cupo y vencimiento.
- Extraer el token de una URL escaneada.
- Decidir el estado de la página de la entrada (antes o después del show, reclamada o no, con o sin check-in, cancelada).
- Generar el `.ics`.

Las rutas de confirmar y check-in se prueban con Prisma mockeado: solo uno gana en doble confirmación, y no hay doble check-in.

## Entrega

- Rama `feat/villains-ball-entradas` desde `main`, con PR.
- **Recomendado:** hacer merge del PR #58 (pool de conexiones con `DATABASE_POOLED_URL`) antes de abrir la venta: el evento suma tráfico y transacciones `Serializable` sobre una base que ya se quedó sin conexiones una vez.
- **Orden de entrega**, para abrir la venta cuanto antes:
  1. Tablas + compra + pago + admin confirmar/WhatsApp + página de la entrada (antes del show).
  2. Check-in.
  3. Carta de después del show + script de agradecimiento.

  Se puede hacer merge y deploy por partes.
- **Antes del primer deploy**, una persona del equipo corre `prisma/sql/2026-10-22-event-tickets.sql` contra producción con `POSTGRES_URL`. No hay variables de entorno nuevas.

## Decisiones tomadas por el diseñador (revisables)

- Sin subida de comprobante: se reemplaza por "Enviar comprobante por WhatsApp" (no hay almacenamiento de archivos).
- Máximo 6 entradas por pedido.
- Una entrada sin reclamar sí entra a la puerta.
- El QR lleva la URL completa, no solo el token.
- "Activar mi cuenta" pasa por correo, no fija la contraseña directo.
- Montos en centavos enteros.
- Ingresos del evento fuera de `Purchase`/`Order`, con exportación CSV para la conciliación.
- El QR del acompañante aparece solo después de reclamar; en la puerta, se puede reclamar ahí o buscar por el comprador.
- Los pedidos pagados se pueden anular (con nota); las cuentas creadas se quedan.
- La carta de después del show aparece desde la medianoche del 30 al 31.
- Registro normal de alguien con cuenta sin contraseña: le llega el correo para elegir contraseña.
- Lista de invitados imprimible como respaldo si falla la señal.

## Respuestas del negocio (22-oct)

- **Factura electrónica (DTE):** no se emite por las entradas.
- **Cuenta:** Banco Cuscatlán, cuenta corriente 152301000036454, titular The Wellnest.
- **WhatsApp del estudio:** +503 7792-3957.
- **Cupo:** no se definió; `capacity` queda nulo (sin tope) y se puede fijar después con un `UPDATE`.
- **Puerta:** quien escanea tiene cuenta ADMIN; no hace falta un rol nuevo.
- **PR #58:** se hace merge antes de abrir la venta.
