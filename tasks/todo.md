# Wellnest: Limpiar Dashboard + Disciplinas Complementarias

## TAREA 1: Limpiar Dashboard (Mock Data → DB Queries)
- [x] `src/app/admin/page.tsx` reescrito como async server component
- [x] Stats reales: ventas del mes (Orders PAID), usuarios totales, nuevos este mes, reservas hoy/semana, paquetes activos
- [x] Clases populares: groupBy reservas por disciplina este mes
- [x] Ventas recientes: últimas 5 orders PAID con usuario y paquete
- [x] Clases de hoy: clases del día con enrolled/capacity desde DB
- [x] Empty states cuando no hay datos
- [x] Removidos imports no usados: TrendingUp, Badge (trend badges)
- [x] Build OK

## TAREA 2: Disciplinas Complementarias

### Schema
- [x] `complementaryDisciplineId String?` agregado a Class model
- [x] Relación FK: `complementaryDiscipline Discipline? @relation("ComplementaryDiscipline")`
- [x] Discipline model: dos relaciones separadas (`PrimaryDiscipline`, `ComplementaryDiscipline`)
- [x] `prisma db push` OK

### Admin API
- [x] `src/app/api/admin/classes/route.ts` (POST/GET): complementaryDisciplineId en schema zod, include, response
- [x] `src/app/api/admin/classes/[id]/route.ts` (GET/PUT): complementaryDisciplineId en schema, validación (no mismo que primary), include, response
- [x] Validación: complementary ≠ primary, disciplina debe existir

### Public API
- [x] `src/app/api/classes/route.ts`: filtro OR (disciplineId || complementaryDisciplineId), include complementaryDiscipline
- [x] `src/app/api/classes/[id]/route.ts`: include complementaryDiscipline

### Admin UI
- [x] `src/app/admin/horarios/page.tsx`: checkbox "¿Tiene disciplina complementaria?" + Select dropdown
- [x] State: hasComplementary, selectedComplementaryId
- [x] handleCreate/handleEdit resetean/setean complementary state
- [x] handleSave envía complementaryDisciplineId en POST/PUT
- [x] Calendar cards muestran "Disciplina + Complementaria"

### Public UI
- [x] `src/app/horarios/page.tsx`: mobile card muestra doble badge, desktop card muestra "Disc + Comp"
- [x] `src/app/(dashboard)/reservar/page.tsx`: interface actualizada, display actualizado

### Scripts
- [x] 3 scripts actualizados: `mapDisciplineSlug` → `mapDisciplineSlugs` retorna { primary, complementary }
- [x] "Yoga + Soundbath" → primary: yoga, complementary: soundbath
- [x] Clases creadas con complementaryDisciplineId

## VERIFICACIÓN FINAL
- [x] Build sin errores
- [x] Schema migrado
- [x] tasks/lessons.md actualizado
