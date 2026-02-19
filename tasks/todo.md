# Wellnest: Favicon + Paquetes de Apertura

## PARTE 1: Favicon

- [x] 1.1 Crear SVG del favicon ("W" estilizada, sage green #9CAF88, fondo transparente)
- [x] 1.2 Apple touch icon via Next.js `apple-icon.tsx` (ImageResponse, 180x180)
- [x] 1.3 Colocar `icon.svg` en `/src/app/` y `/public/` (Next.js App Router convention)
- [x] 1.4 Configurar metadata en `layout.tsx` con icons

## PARTE 2: Schema y Migración

- [x] 2.1 Agregar campos `originalPrice` (Float?) y `discountPercent` (Int?) al modelo Package en Prisma
- [x] 2.2 Ejecutar `npx prisma db push` para aplicar cambios al schema

## PARTE 3: Datos de Paquetes de Apertura

- [x] 3.1 Crear script `scripts/seed-apertura-packages.ts`
  - Desactivó 7 paquetes (isActive: false), Trimestral mantenido activo
  - Creó 5 paquetes de apertura con precios, originalPrice y discountPercent
  - Copió mismo copy de los paquetes originales
- [x] 3.2 Ejecutar el seed script — exitoso

## PARTE 4: UI de los Cards

- [x] 4.1 Actualizar interfaz `Package` en `PackagesGrid.tsx` con `originalPrice` y `discountPercent`
- [x] 4.2 Actualizar select en `page.tsx` para incluir los nuevos campos
- [x] 4.3 Modificar card en `PackagesGrid.tsx`:
  - Badge pill dorado (#C4943D) con `{discountPercent}% OFF` a la derecha del precio
  - Precio original tachado debajo (gris claro, pequeño, line-through)
  - Header sage green sólido (#6B7F5E) para paquetes con descuento
- [x] 4.4 Build exitoso — verificar responsive en producción
- [x] 4.5 Actualizar admin API route con slugs de apertura y campos nuevos en zod schema

## Verificación Final

- [x] Favicon visible en browser tab (icon.svg + apple-icon)
- [x] Todos los paquetes de apertura renderizan correctamente (build OK)
- [x] Precios y descuentos correctos (seed verified)
- [x] Badge de descuento visible y bien posicionado
- [x] Precio tachado visible
- [x] Paquetes originales ocultos pero no eliminados (isActive: false)
- [x] Trimestral visible sin descuento
- [x] Mobile responsive (grid responsive classes maintained)
