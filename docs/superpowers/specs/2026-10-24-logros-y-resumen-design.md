# Logros, visibilidad y correo de resumen — diseño

Fecha: 24-oct-2026 · Pedido por: José Bidegain · Estado: José pidió avanzar sin preguntas ("avanza sin preguntas"); todo lo de abajo es decisión de Claude salvo lo que se cita como pedido.

Extiende "Mi progreso" (spec `2026-10-24-mi-progreso-design.md`, PR #66).

## Pedido (palabras de José)

1. "Expande el tema de hitos, quiero que copiemos Apple con sus awards": badges diseñados más a detalle, con "su espacio único" y "badges de muchos temas para que siempre haya algo que perseguir".
2. "Dejar este feature más a la vista de la usuaria cuando entra al site para que sea algo que ven siempre".
3. "Programemos un correo con el resumen de una clase con un botón al site para que vean su pantalla de progreso".

Éxito = la usuaria siempre tiene un próximo logro a la vista, ve su avance sin buscarlo, y después de clase recibe un correo bonito que la lleva a su progreso.

## Parte 1 — Logros (estilo Apple Fitness Awards)

### Fuente de datos
Igual que Mi progreso: reservas `ATTENDED` propias (`loadAttendedClasses`). Los logros **se calculan**, no se guardan: se recorren las clases en orden cronológico y cada logro guarda la fecha de la clase con que se alcanzó (`earnedAt`). Sin tablas para logros.

### Catálogo (lógica pura en `src/lib/progress/badges/`)
Cada logro: `id` estable (kebab-case), `category`, `title`, `description` (qué hay que hacer), `tier` (1–5, define el metal), `target` (número), progreso actual y `earnedAt | null`.

| Categoría (forma) | Logros | Regla |
|---|---|---|
| **Clases** (medallón redondo) | 1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, y luego cada +100 sin fin | clases asistidas totales |
| **Disciplinas** (hexágono, color de la disciplina) | por disciplina: 1, 10, 25, 50, 100 — `pole`, `pilates`, `yoga`, `aro`, `telas`, `soundbath`, `baile` | clases de esa disciplina; `aro-telas` cuenta para `aro` y para `telas`; disciplinas sin perfil propio no tienen fila |
| **Constancia** (escudo) | racha de 2, 4, 8, 12, 26, 52 semanas | **mejor** racha semanal histórica (semanas lun–dom SV con ≥1 clase), no la actual: una racha rota no quita nada |
| **Semanas activas** (sol) | 1, 5, 10, 25, 50 semanas | semanas con ≥150 min activos (referencia OMS, `WEEKLY_TARGET_MINUTES`) |
| **Reto del mes** (emblema con el nombre del mes) | uno por mes calendario | meta personal del mes = `clamp(ceil(promedio de clases de los 3 meses anteriores × 1.1), 4, 20)`; sin historial = 4. Se gana al llegar a la meta en ese mes. Los meses no logrados **no se muestran** |
| **Exploradora** (brújula) | 3, 5 y 7 disciplinas distintas | disciplinas distintas asistidas (`aro-telas` cuenta como aro y telas) |
| **Calma** (loto) | 60, 180, 600, 1200 min | minutos de calma acumulados (misma ponderación que "Flexibilidad y calma" de Mi progreso) |
| **Momentos** (gota/estrella) | Mañanera (10 clases que empiezan antes de las 9:00), Atardecer (10 clases desde las 19:00), Doble sesión (2 clases el mismo día), Fin de semana (5 clases sábado/domingo), Semana completa (clases en 3 días distintos de una misma semana), Aniversario 1, 2, 3 (1/2/3 años desde la primera clase, contando que haya ido al menos una vez ese año) | hora y día en America/El_Salvador |

Total ≈ 80 logros más uno nuevo cada mes: siempre hay algo que perseguir. El reto del mes en curso siempre está visible.

`tier` dentro de cada categoría según el orden del umbral (primero = 1). En "Clases", los umbrales después de 500 usan tier 5.

### Diseño de las insignias
- Cada insignia es un **SVG generado por una función pura** (`renderBadgeSvg(badge, { locked })` → string), la misma fuente para la web y para los PNG del correo.
- Inspiración Apple: medallas con relieve. Borde metálico con degradado (5 metales: cobre, arena, salvia, oro cálido, platino perlado, derivados de la paleta de la marca `#C4A77D`, `#9CAF88`, `#6B7F5E`, `#FFF8EF`, `#453C34`), cara interior con degradado del color de la categoría (o de la disciplina), brillo diagonal suave, glifo propio dibujado a mano para cada tema (no íconos genéricos) y el número grande cuando aplica. **Forma distinta por categoría** (tabla de arriba) para que se reconozcan de un vistazo.
- **Bloqueada**: silueta beige plana, sin brillo, glifo tenue, y alrededor un arco de progreso con el avance ("7 de 10").
- El implementador usa la skill `frontend-design` para afinar el arte; la tabla de formas y la paleta son fijas.

### Espacio propio: `/perfil/logros`
- Ítem **"Mis logros"** (ícono Trophy) en el menú lateral del perfil, tercero (después de Mi Perfil y Mi Progreso), y en el menú de usuaria del Navbar.
- Encabezado: "X logros ganados" y el **Reto del mes** como tarjeta destacada (insignia grande, meta, progreso "5 de 8 clases", días que quedan).
- "Recientes": los últimos ganados (hasta 6).
- Secciones por categoría, en cuadrícula (3 columnas en móvil, 5–6 en escritorio); ganadas primero y luego bloqueadas, por umbral. En "Clases" se muestran las ganadas + las próximas 3; en "Reto del mes" solo los meses ganados.
- Tocar una insignia abre un detalle (modal/hoja inferior en móvil): insignia grande, título, descripción, "Ganado el 12 oct 2026" o la barra de progreso, con animación de giro suave al abrir (respetando `prefers-reduced-motion`).

### En Mi progreso
La tarjeta "Hitos" se reemplaza por **"Logros"**: Reto del mes (mini insignia + progreso), últimos 3 ganados y los 2 más cercanos a ganarse (mayor porcentaje de avance), con botón "Ver todos mis logros". "Tu última clase" en `/perfil` sigue igual.

### Celebración de logro nuevo
Al entrar a cualquier página con sesión, si hay un logro ganado que este dispositivo no ha visto, aparece un modal de celebración (insignia con brillo/escala, "¡Nuevo logro!", título, botones "Ver mis logros" y "Cerrar"). Si son varios, muestra el más reciente y "+N más". Vistos en `localStorage` (`wellnest:logros:vistos`, try/catch). Primera vez en el dispositivo (sin clave): se marcan vistos todos los ganados hace más de 7 días, para no celebrar 30 logros de golpe al lanzar.

## Parte 2 — Más a la vista

1. **Anillo en el Navbar** (todas las páginas, móvil y escritorio): el botón de la usuaria lleva un anillo fino con los minutos activos de la semana vs. 150, y un punto cuando hay un logro sin ver. Al tocarlo el menú ya ofrece Mi progreso / Mis logros.
2. **Franja en la home** con sesión, justo debajo del Navbar y encima del hero: mini anillo + "105 de 150 min esta semana · Racha de 9 semanas · Próximo logro: 50 clases (faltan 8)" + "Ver mi progreso". Sin clases asistidas: "Reserva tu primera clase y empieza a sumar logros" + botón Reservar. Sin sesión: no aparece.
3. **Celebración** de la Parte 1.

Datos: `GET /api/user/progress/glance` (sesión, 401 sin ella) → `{ week: { activeMinutes, targetMinutes }, streakWeeks, totalClasses, nextBadge: { id, title, current, target } | null, recentBadges: { id, title, earnedAt }[] (ganados en los últimos 30 días) }`. Un proveedor en cliente lo pide una vez por carga de página cuando la sesión está autenticada y lo comparten Navbar, franja y celebración.

## Parte 3 — Correo de resumen de clase

- **Cuándo**: cron de Vercel dos veces al día (plan Hobby: solo diario, se puede repetir la entrada): `15 19 * * *` (13:15 SV) y `45 3 * * *` (21:45 SV), ruta `/api/cron/class-summary` con el mismo control `CRON_SECRET` que los otros crons. Cada corrida toma reservas `ATTENDED`, no de invitada, cuya clase **terminó** (`dateTime + duration ≤ ahora`) en las últimas 24 horas y que no tienen correo enviado. Así el día del lanzamiento no se manda historial viejo.
- **Una usuaria, un correo por corrida**: si tuvo varias clases en esa ventana, un solo correo con la más reciente destacada y las demás listadas.
- **Contenido** (HTML como los demás de `emailService.ts`, con su estilo): saludo con el primer nombre; tarjeta de la clase (disciplina, tipo, hora, minutos, intensidad, foco); "Tu semana: X de 150 min" con barra; racha; **logros ganados con esa(s) clase(s)** con su PNG, o si no, el próximo logro con su progreso; botón **"Ver mi progreso"** → `${NEXTAUTH_URL}/perfil/progreso`. Terapia de sonido: "Clase de calma". **Sin calorías** (en la web son opt-in). Asunto: `Tu resumen de {Disciplina}`.
- **PNG de insignias**: `scripts/render-badge-pngs.ts` usa `renderBadgeSvg` + `sharp` (ya instalado) y escribe `public/images/badges/<id>.png` (240 px, estado ganado) para todo el catálogo fijo, los "Clases" hasta 2000 y 12 PNG de reto (`reto-ene` … `reto-dic`). Se commitean. `/images/` ya está exento de la puerta de QA. Un logro sin PNG muestra solo el texto.
- **Darse de baja**: interruptor "Recibir un resumen por correo después de cada clase" en Mi progreso (encendido por defecto) y enlace al pie del correo "Ya no quiero estos resúmenes" → `/api/email/progress-unsubscribe?u=<userId>&t=<HMAC-SHA256(NEXTAUTH_SECRET, "progress-email:"+userId)>` que guarda la baja y redirige a una página simple de confirmación con opción de volver a activarlo desde Mi progreso.
- **No duplicar**: antes de enviar se reclaman las reservas insertando en `ProgressEmailLog` (único por `reservationId`, `skipDuplicates`); solo se envía lo que esta corrida reclamó; si el envío falla se borran esos reclamos para reintentar en la próxima corrida.
- **QA**: `sendEmail` ya desvía los correos en QA; no hace falta nada extra.

### Esquema (SQL manual, solo agrega)
`prisma/sql/2026-10-24-logros-correo-progreso.sql` crea dos tablas nuevas (no toca columnas existentes, así el código actual sigue funcionando aunque el SQL aún no esté):
- `ProgressEmailLog` (`id`, `reservationId` único → Reservation ON DELETE CASCADE, `userId` → User ON DELETE CASCADE, `sentAt`).
- `ProgressEmailOptOut` (`userId` PK/único → User ON DELETE CASCADE, `createdAt`).
Modelos equivalentes en `schema.prisma`. Orden: SQL en QA antes de mergear a `develop`; en producción lo corre José antes de mergear la promoción. Nunca `prisma db push`.

## No-metas
- Sin notificaciones push, sin compartir logros en redes (queda para "Wrapped", fase 2), sin logros por calorías, peso o comparación con otras usuarias, sin rankings.
- Sin cambiar el login ni la página a la que lleva.

## Anti-metas
- Culpa: nunca mostrar retos fallados, rachas perdidas como pérdida, ni "no fuiste".
- Spam: más de un correo por clase, o correos sin forma de darse de baja en un clic.
- Celebrar decenas de logros de golpe al lanzar.
- Romper `/perfil`, la home o el Navbar para quien no tiene sesión o no tiene clases.

## Restricciones
- Next.js 14 App Router, Tailwind con tokens de marca, `lucide-react` para íconos de interfaz (no para el arte de las insignias), sin librerías nuevas.
- Lógica pura con tests de Vitest en `src/lib/progress/badges/` y del correo; nunca `any`.
- Recordar el bug conocido: los modificadores de opacidad en colores de marca (`bg-primary/10`) no generan CSS; usar los tonos `primary-50`/`primary-100` o colores explícitos.
- Copy en español, tono cálido de `/perfil`. Móvil primero.
- Flujo: rama `feat/logros-progreso` desde `develop`, PR a `develop`, probar en QA (cuentas de José y Adriana ya tienen datos sembrados), promoción a `main` la aprueba José.
