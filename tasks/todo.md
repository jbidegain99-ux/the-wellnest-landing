# Rediseño cards Horarios (mobile) + días colapsados

## FASE 0 — Hallazgos de investigación

Todo el horario público vive en **un solo archivo**: `src/app/horarios/page.tsx` (726 líneas, `'use client'`).
Colores por disciplina: `src/config/disciplineColors.ts` (fuente central ya existente).

| Concern | Ubicación |
|---|---|
| `MobileClassCard` (card mobile) | `horarios/page.tsx:66-168` |
| `MobileDayAccordion` (acordeón día) | `horarios/page.tsx:171-263` |
| Render mobile (mapea `weekDates`) | `horarios/page.tsx:524-536` (`md:hidden`) |
| Render desktop (grid 7 col, cards rellenas) | `horarios/page.tsx:538-639` (`hidden md:block`) |
| **Acento lateral** | línea **86** (`border-l-4 ... shadow-sm`) + **88** (`disciplineBorderColors[slug]`) |
| **Estado expansión** | línea **186**: `useState(isToday \|\| classes.length > 0)` — local por acordeón |
| Status (finalizada/lleno/cupos) | líneas 75-79 + 148-164 |
| Key del acordeón | línea **527**: `key={index}` (no remonta al navegar) |

**Decisiones de diseño validadas contra el design system real (NO contra el prompt):**
- **Fuentes:** el config real mapea `sans/serif/logo` -> **Quicksand** (NO Cormorant/Jost; el README esta desactualizado). El subtitulo de clase ya usa `italic` -> se conserva. No se introducen fuentes nuevas.
- **Colores de marca reales:** `primary #9CAF88`, `accent #C4A77D`, bg crema `#FFF8EF`, lista mobile `#F5F3EF`. (Los hex del prompt #639922/#E8DCC8/#FAF9F6 no existen -> gana el design system.)
- **Radio:** sin tokens custom; convencion de cards = `rounded-2xl` (primitive `Card`). Card mobile pasa de `rounded-xl` -> `rounded-2xl`.
- **Elevacion:** el sitio **usa sombras** (`Card` = `shadow-sm` rest / `shadow-md` hover). Opcion C -> `shadow-sm` (misma escala), **sin borde**. Separacion por elevacion + tinte.
- **Color por disciplina:** ya hay fuente central (`disciplineColors.ts` + `getDisciplineHexColor`). `Discipline` NO tiene campo `color`. Memoria `project_db_push_danger` advierte NO correr `prisma db push` -> un campo en DB exige migracion riesgosa y fuera de scope. **Recomendacion: extender la constante central existente** (helper de tinte) en vez de migrar schema.

## TAREA 1 — Card Opcion C (mobile)
1. `disciplineColors.ts`: agregar `getDisciplineTintColor(slug, amount)` (mezcla el hex hacia blanco -> superficie solida tintada) construido sobre `getDisciplineHexColor` (mismo fallback neutral `#9CAF88`). Fuente unica.
2. `MobileClassCard` (86-93): **eliminar `border-l-4` y `disciplineBorderColors[...]`**; quitar `bg-white`; aplicar `rounded-2xl shadow-sm` + `style={{ backgroundColor: getDisciplineTintColor(slug) }}`; `isPast` -> `opacity-60`.
3. Fila de disciplina (98-120): reemplazar el pill solido por **punto de color** + nombre en texto sobrio. Igual para la complementaria (`+ • nombre`).
4. Conservar TODO: tipo de clase (italic), hora+duracion, instructor, status box (cupos/lleno/finalizada con su icono). "Finalizada" queda atenuada por `opacity-60` + caja stone.
5. Tinte: default ~10-12%; **ajustar con screenshots** para contraste sobre `#F5F3EF`.
6. **Desktop intacto** (render separado, no comparte componente).

## TAREA 2 — Dias colapsados (mobile)
7. Linea 186: `useState(isToday || classes.length > 0)` -> `useState(false)`.
8. Header (198-240): agregar `aria-expanded={isOpen}` + `aria-controls`. Chevron ya refleja estado.
9. Animacion de altura suave: envolver la lista en wrapper `grid grid-rows-[0fr]/[1fr] transition-[grid-template-rows] duration-300` + inner `overflow-hidden` (tecnica CSS sin medir JS), renderizando la lista siempre. Counter "N clases" ya visible colapsado.
10. Key del acordeon (527): `key={index}` -> `key={format(date,'yyyy-MM-dd')}` para que al navegar mes/semana remonte y quede colapsado. Filtro de disciplina no cambia fechas -> permanece colapsado.
11. Apertura multiple (estado local por dia) se conserva.

## Verificacion
`npm run lint` -> `npm run build` -> `npm run dev` viewport 375px -> screenshots a `tasks/prompts/Assets/horarios-cards-final/`.

## Review — COMPLETADO

**Archivos tocados (2):**
- `src/config/disciplineColors.ts`: + `hexToRgb()` + `getDisciplineTintColor(slug, amount=0.15)` (deriva el tinte de `getDisciplineHexColor`, misma fuente única + fallback `#9CAF88`).
- `src/app/horarios/page.tsx`: card mobile rediseñada + acordeón colapsado/animado + key por fecha. Desktop intacto.

**Decisiones finales:**
- Fuente de color: **constante central existente** (sin migración DB) — confirmado por el usuario.
- Scope: **solo mobile** — confirmado por el usuario; desktop usa render separado (verificado sin regresión).
- Elevación: `shadow-sm` (convención real del sitio, primitive `Card`), **sin borde**.
- Tinte: 15% (sólido, mezcla hacia blanco) — subido desde 8-10% de referencia porque sobre el fondo crema `#F5F3EF` 10% era casi imperceptible. El punto de color es la señal primaria.
- Radio: `rounded-2xl` (alineado al primitive `Card`).
- `inert` se renderiza como string `""` (React 18.3 no lo tiene en su allowlist booleana; un boolean dispara warning de consola).

**Criterios de aceptación:**
- [x] No hay barra/acento lateral (eliminado `border-l-4` + `disciplineBorderColors`).
- [x] Opción C: sin borde, tinte por disciplina, punto de color.
- [x] Elevación coherente (`shadow-sm`) — documentada.
- [x] Tokens reutilizados (hex de `DISCIPLINE_COLORS`, `rounded-2xl`, `text-foreground`).
- [x] Color desde UNA fuente con fallback neutral; no hardcodeado por card.
- [x] Conserva disciplina, nombre clase (italic), hora, duración, instructor, estado.
- [x] "Finalizada" atenuada (opacity-60 + caja stone); "N cupos" con icono.
- [x] Cohesivo con header/dropdown/leyenda.
- [x] Días inician colapsados; ninguno abierto (ni Hoy).
- [x] Abrir/cerrar con animación (grid 0fr→1fr) + `aria-expanded`/`aria-controls` + `inert`.
- [x] Counter "N clases" visible colapsado.
- [x] Navegar semana mantiene colapsados (key por fecha → remonta); filtro no auto-expande.
- [x] Desktop sin regresiones (verificado a 1280px).
- [x] `tsc` + `build` pasan; consola sin errores (solo warning pre-existente de meta tag).

**Screenshots:** `tasks/prompts/Assets/horarios-cards-final/` (01 colapsados, 02 cards activas zoom, 03 día expandido hoy, 04 desktop).

**Nota lint:** `npm run lint` no está configurado en el repo (prompt interactivo de setup); se usó `npx tsc --noEmit` + `npm run build` para type-check.
