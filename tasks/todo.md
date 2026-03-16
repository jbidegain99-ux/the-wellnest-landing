# Wellnest: Correcciones — Card refresh + classType display + Horarios BD

## PROBLEMA 1: Card no se actualiza después de editar hora
- [x] Causa raíz: bug de timezone en PUT endpoint (`setHours`/`setMinutes` de date-fns usa timezone local del servidor)
- [x] Fix: `src/app/api/admin/classes/[id]/route.ts` — reconstruir dateTime con `Date.UTC()` + `EL_SALVADOR_UTC_OFFSET`
- [x] Removido import de `setHours`/`setMinutes` de date-fns
- [x] Ahora PUT usa mismo patrón que POST: `hours + EL_SALVADOR_UTC_OFFSET`

## PROBLEMA 2: "test" → "Clase de Prueba" en UI
- [x] Helper `formatClassType()` creado en `src/lib/utils.ts`
- [x] Aplicado en `src/app/admin/horarios/page.tsx` (calendar cards)
- [x] Aplicado en `src/app/horarios/page.tsx` (mobile + desktop cards)
- [x] Aplicado en `src/app/admin/asistencias/page.tsx` (lista de clases)
- [x] Aplicado en `src/app/admin/asistencias/[classId]/page.tsx` (detalle)

## PROBLEMA 3: Horarios incorrectos en BD
- [x] Causa raíz: scripts usaban `Date.UTC(y,m,d,hh,mm)` sin offset → 6 horas tarde
- [x] Fix: `hh + 6` en los 3 scripts (load-test, week9-14, week16-21)
- [x] Recargadas 86 clases con timezone correcto
- [x] 12 test classes verificadas contra Excel ✓
- [x] Total: 94 clases en BD (8 pre-existentes + 86 scripts)

## VERIFICACIÓN
- [x] Build sin errores
- [x] 12 test classes coinciden con Excel (horas SV correctas)
- [x] tasks/lessons.md actualizado

---

# Extensión de Vigencia Pre-Marzo + Deducción de Paquetes Admin

## Vigencia Pre-Marzo
- [x] Audit script: identificar compras antes de 2026-03-09T06:00:00Z
- [x] Migration script: extender expiresAt a 2026-04-09T23:59:59 SV (idempotente)

## Deducción de Paquetes
- [x] API endpoint: POST /api/admin/users/[id]/deduct-package (con validación y logging)
- [x] API endpoint: GET /api/admin/users/[id]/purchases (para poblar dropdown)
- [x] Admin UI: modal de deducción en página de usuarios (con confirmación visual)

## Testing
- [ ] Ejecutar audit script y verificar output
- [ ] Ejecutar migration script en --dry-run primero
- [ ] Probar deducción via UI: caso exitoso, balance insuficiente
- [ ] Verificar que deducción a 0 marca Purchase como DEPLETED
