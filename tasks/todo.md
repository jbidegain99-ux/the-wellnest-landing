# Wellnest: Limpiar Dashboard/Admin + Cargar Horarios (3 hojas)

## TAREA 1: Limpiar Dashboard
- [x] Archivo: `src/app/admin/page.tsx`
- [x] Removida sección "Herramientas de Administración" (Card con SeedDatabaseButton)
- [x] Removidos imports: Settings, SeedDatabaseButton
- [x] Build OK

## TAREA 2: Limpiar Admin Configuración
- [x] Archivo: `src/app/admin/configuracion/page.tsx`
- [x] Removida sección "Administración de Base de Datos" completa
- [x] Removidos botones "Poblar Base de Datos" y "Limpiar Datos de Prueba"
- [x] Removidos handlers, state vars e imports no usados
- [x] Build OK

## TAREA 3: Cargar Horarios desde Excel (3 hojas)

### Script A: load-test-schedules.ts
- [x] 12 clases de prueba (4-7 marzo 2026) → classType="test"
- [x] Ejecutado OK

### Script B: load-fixed-schedule-week9-14.ts
- [x] 37 clases regulares (9-14 marzo 2026) → classType="regular"
- [x] Ejecutado OK (Excel tiene 37 filas, no 38)

### Script C: load-fixed-schedule-week16-21.ts
- [x] 37 clases regulares (16-21 marzo 2026) → classType="regular"
- [x] Ejecutado OK

### Totales
- [x] 86 nuevas clases cargadas (12 + 37 + 37)
- [x] 96 clases totales en BD (10 pre-existentes + 86 nuevas)

## VERIFICACIÓN FINAL
- [x] Build sin errores (`npx next build` OK)
- [x] Datos verificados por fecha y tipo
- [x] tasks/lessons.md actualizado

## DATOS AUXILIARES CREADOS
- Instructores nuevos: Dani, Jaime, Vicky, Jessica
- Disciplina "Aro y Telas" corregida (tenía ID vacío)
