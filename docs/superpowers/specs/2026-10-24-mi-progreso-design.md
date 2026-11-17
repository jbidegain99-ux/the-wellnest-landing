# Mi progreso — diseño

Fecha: 24-oct-2026 · Pedido por: José Bidegain · Estado: aprobado por José ("si dale avanza": pidió saltar las preguntas; las decisiones de abajo son de Claude salvo donde dice lo contrario)

## Por qué

José quiere que las usuarias de Wellnest vean su avance cuando toman clases: calorías de una clase, cuánta actividad tuvieron y qué tipo de fuerza trabajaron, **sin medir nada** (sin relojes ni sensores), más avances en flexibilidad y en relajación con terapia de sonido. Debe estar dentro del perfil y con un atajo fácil de encontrar al abrir la app.

Éxito = una usuaria abre la app después de clase y en un toque ve qué hizo hoy y cómo viene su mes, con números honestos y un tono de bienestar (no de gimnasio agresivo), y eso la motiva a volver.

## Fuente de datos

Todo sale de lo que ya existe: reservas con `status = 'ATTENDED'` de la propia usuaria (`Reservation.userId`, `isGuestReservation = false`), unidas a `Class` (`dateTime`, `duration` en minutos, `classType`, `isPrivate`) y `Discipline` (`slug`, `name`). Sin tablas nuevas, sin cambios de esquema, sin SQL manual.

Disciplinas reales hoy (slug): `pole`, `pilates` (Mat Pilates), `yoga`, `aro`, `telas`, `aro-telas`, `soundbath` (Terapia de Sonido), `baile`, `nutricion` (sin clases). Una disciplina desconocida o nueva cae en un perfil genérico (MET 3.0, foco "Movimiento").

## Qué ve la usuaria

### Atajos
- Tarjeta **"Tu última clase"** arriba de `/perfil` (Mi Perfil): disciplina, fecha, minutos, foco trabajado y botón "Ver mi progreso". Si no tiene clases asistidas: invitación a reservar.
- Ítem **"Mi Progreso"** en el menú lateral del perfil (segundo, después de "Mi Perfil") y en el menú de usuaria del Navbar (escritorio y móvil).
- Atajo de la app instalada (PWA): `shortcuts` en `public/manifest.json` → "Mi progreso" (`/perfil/progreso`) y "Reservar" (`/reservar`). Al mantener presionado el ícono aparece el atajo.

### Página `/perfil/progreso`
1. **Tu última clase** (detalle): disciplina + tipo de clase, fecha, minutos, intensidad (Calma / Suave / Moderada / Intensa), chips de foco ("Core", "Tren superior", "Agarre", "Flexibilidad"…), y calorías estimadas solo si ella las activó.
2. **Tu semana**: minutos activos de la semana actual (lunes–domingo, hora de El Salvador) vs. la referencia de la OMS de 150 min/semana, como anillo de progreso, y clases de la semana.
3. **Racha semanal**: semanas consecutivas con al menos 1 clase, contando hacia atrás desde la semana actual; si la semana actual aún no tiene clase, la racha cuenta desde la anterior y el texto invita sin culpa ("Esta semana todavía estás a tiempo"). Nunca mensajes de castigo.
4. **Tu mezcla (últimos 30 días)**: radar SVG propio (sin librerías) con 6 ejes: Fuerza, Flexibilidad, Equilibrio, Core, Energía, Calma. Subtítulo: "En qué invertiste tu práctica" (no "tu nivel").
5. **Flexibilidad y calma este mes**: minutos de práctica que suman a flexibilidad (ponderados por disciplina) y minutos de calma (terapia de sonido y la parte de calma de yoga), con comparación vs. el mes anterior ("+20 min vs. septiembre"). Texto honesto: es práctica acumulada, no medición.
6. **Hitos**: 1, 10, 25, 50, 100 clases (alcanzados y el próximo con cuánto falta) y "Exploradora" al probar 3 disciplinas distintas.
7. **Mes a mes**: clases y minutos de los últimos 6 meses (barras simples en CSS/SVG).
8. Interruptor **"Mostrar calorías estimadas"** (apagado por defecto), guardado en `localStorage` del dispositivo; con try/catch (si falla, queda apagado).
9. Pie de página: "Estimaciones según el tipo y la duración de cada clase. No reemplazan una evaluación profesional."

## Cálculos (lógica pura en `src/lib/progress/`, con tests)

### Perfiles por disciplina
Cada perfil: `met`, `intensity`, `focus` (chips), y pesos 0–1 por eje del radar.

| slug | MET (Compendium 2024) | Intensidad | Foco (chips) | Fuerza | Flex | Equil | Core | Energía | Calma |
|---|---|---|---|---|---|---|---|---|---|
| pilates | 2.8 (02105) | Moderada | Core, Postura, Estabilidad | 0.5 | 0.4 | 0.5 | 1.0 | 0.3 | 0.3 |
| yoga | 2.3 (02150); 2.7 si `classType` contiene "vinyasa" (02185); 3.0 "sculpt"/"power" | Suave (Moderada si vinyasa/sculpt/power) | Flexibilidad, Equilibrio, Fuerza isométrica | 0.4 | 1.0 | 0.8 | 0.5 | 0.3 | 0.7 |
| pole | 4.5 (02108, pole) | Intensa | Tren superior, Agarre, Core | 1.0 | 0.5 | 0.4 | 0.8 | 0.7 | 0.1 |
| aro | 4.5 (proxy 02108) | Intensa | Tren superior, Agarre, Flexibilidad | 0.9 | 0.7 | 0.5 | 0.7 | 0.6 | 0.1 |
| telas | 4.5 (proxy 02108) | Intensa | Tren superior, Agarre, Flexibilidad | 0.9 | 0.7 | 0.4 | 0.7 | 0.6 | 0.1 |
| aro-telas | 4.5 | Intensa | Tren superior, Agarre, Flexibilidad | 0.9 | 0.7 | 0.5 | 0.7 | 0.6 | 0.1 |
| baile | 5.0 (03010) | Intensa | Coordinación, Cardio, Piernas | 0.4 | 0.3 | 0.5 | 0.4 | 1.0 | 0.3 |
| soundbath | 1.0 (07075) | Calma | Relajación, Respiración | 0 | 0 | 0 | 0 | 0 | 1.0 |
| (genérico) | 3.0 | Moderada | Movimiento | 0.5 | 0.4 | 0.4 | 0.5 | 0.5 | 0.3 |

La intensidad que se muestra es la columna "Intensidad" de la tabla (no se deriva del MET).

### Calorías (solo si están activadas)
Calorías **activas** (sin el gasto en reposo, como Apple): `kcal = (MET − 1) × peso × horas`. Sin peso conocido se usa el rango 55–75 kg y se muestra el rango redondeado a decenas: "≈ 80–110 kcal". Terapia de sonido (MET 1.0) muestra "Clase de calma: sin gasto activo" en lugar de calorías. No se pide peso. Nunca equivalencias de comida ni lenguaje de "quemar/compensar".

### Minutos activos
Minutos de clases con MET ≥ 1.5 (todas menos terapia de sonido). Las de terapia de sonido suman a "minutos de calma".

### Radar (últimos 30 días)
Para cada eje: `Σ minutos × peso` de las clases asistidas en los últimos 30 días; se normaliza dividiendo por el máximo de los 6 ejes (el eje mayor = 1). Sin clases → radar vacío con mensaje.

### Flexibilidad y calma por mes
`minutos_flex = Σ minutos × peso_flex`, `minutos_calma = Σ minutos × peso_calma`, mes calendario actual vs. anterior (hora de El Salvador), redondeados a minutos enteros.

### Semanas y racha
Semanas lunes–domingo en `America/El_Salvador` (date-fns-tz ya está instalado). Racha: semanas consecutivas con ≥1 clase asistida, terminando en la semana actual si tiene clase, o en la anterior si no.

## API

`GET /api/user/progress` — requiere sesión (mismo patrón que las otras rutas de `/api/user/*`). Devuelve un JSON con todo lo que la página necesita (última clase, semana, racha, radar, flex/calma mes actual y anterior, hitos, 6 meses, perfiles de foco) calculado en el servidor con la lógica pura; nunca datos de otras usuarias. Consulta solo las reservas ATTENDED de la usuaria (todas, para hitos; el resto se filtra por fecha). Tipos TypeScript explícitos, sin `any`.

## No-metas
- Sin check-ins de cómo se sintió, sin autotest de flexibilidad, sin escala de estrés antes/después (necesitan tablas nuevas → fase 2).
- Sin mapa corporal SVG (fase 2), sin "Wrapped" compartible (fase 2), sin pedir peso.
- Sin rankings ni comparación con otras usuarias.

## Anti-metas
- Prometer resultados ("mejoraste tu fuerza un 20%", "quemaste grasa").
- Calorías visibles por defecto o lenguaje de dieta.
- Mensajes que castiguen una racha rota.
- Mostrar datos de otra usuaria, o romper /perfil para quien no tiene clases.

## Restricciones
- Next.js 14 App Router, componentes existentes (`Card`, `Badge`, `Button`, iconos `lucide-react`), Tailwind con los colores de la marca (`primary`, `beige`). Nada de librerías nuevas de gráficos.
- Copy en español, con el mismo tono que ya usa `/perfil` (el implementador lo toma de ahí).
- Móvil primero: la mayoría abre la app desde el celular.
- Nunca `any`. Lógica pura en `src/lib/progress/` con tests de Vitest.
- Flujo nuevo: rama `feat/mi-progreso` desde `develop`, PR a `develop`, probar en QA con la cuenta de Adriana (12 clases asistidas), y después promoción a `main` que aprueba José.
