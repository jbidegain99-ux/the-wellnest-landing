-- Catálogo de eventos: columnas nuevas en "Event" + datos de The Villains Ball.
--
-- Correr con POSTGRES_URL (conexión directa) ANTES de desplegar el código que las usa.
-- NO usar prisma db push. Aditivo e idempotente: el código anterior sigue funcionando.

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isActive"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "ticketsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "summary"        TEXT    NOT NULL DEFAULT '';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "description"    TEXT    NOT NULL DEFAULT '';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "imageUrl"       TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "pagePath"       TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "codePrefix"     TEXT    NOT NULL DEFAULT 'EV-';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "theme"          TEXT    NOT NULL DEFAULT 'wellnest';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "thanksMessage"  TEXT;

CREATE INDEX IF NOT EXISTS "Event_isActive_startsAt_idx" ON "Event"("isActive", "startsAt");

UPDATE "Event" SET
  "isActive"      = true,
  "summary"       = 'A Halloween Show by Wellnest. Los villanos que conocés cobran vida a través del pole, el aro y la tela.',
  "description"   = 'Una noche donde el cine, el movimiento y la interpretación se encuentran en un mismo escenario. Cada personaje es una interpretación única a través del movimiento, el arte aéreo y la puesta en escena. Durante la noche habrá espacios de comida y marcas invitadas.',
  "imageUrl"      = '/halloween/invitacion.jpg',
  "pagePath"      = '/halloween',
  "codePrefix"    = 'HW-',
  "theme"         = 'villains',
  "thanksMessage" = 'Fue un honor tenerte en The Villains Ball. Lo que viste en escena se entrena en Wellnest: pole, aro y tela.'
WHERE "slug" = 'villains-ball' AND "pagePath" IS NULL;

-- Verificación: si The Villains Ball no quedó visible con su configuración,
-- abortar (sin esto su venta se cerraría en silencio al desplegar).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Event"
    WHERE "slug" = 'villains-ball' AND "isActive" AND "codePrefix" = 'HW-' AND "theme" = 'villains' AND "pagePath" = '/halloween'
  ) THEN
    RAISE EXCEPTION 'The Villains Ball no quedó configurado: revisar el UPDATE antes de desplegar';
  END IF;
END
$$;

SELECT "slug", "isActive", "salesOpen", "theme", "codePrefix", "pagePath" FROM "Event" ORDER BY "startsAt";

