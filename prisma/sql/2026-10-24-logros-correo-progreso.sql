-- Logros y resumen por correo: tablas ProgressEmailLog y ProgressEmailOptOut.
--
-- Orden:
--   1. QA primero, antes de mergear a develop.
--   2. Producción: la corre solo José, justo antes de mergear la promoción
--      (release) que trae el correo de resumen de clase.
--
-- Correr con POSTGRES_URL (conexión directa), no con DATABASE_URL de
-- Accelerate (rechaza CREATE/ALTER). NO usar prisma db push: borra el índice
-- único parcial "Purchase_gateway_provider_id_key" creado a mano.
--
-- Solo agrega tablas nuevas (no toca columnas existentes). Idempotente: se
-- puede correr más de una vez sin efectos.

CREATE TABLE IF NOT EXISTS "ProgressEmailLog" (
  "id"            TEXT         NOT NULL,
  "reservationId" TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "sentAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressEmailLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgressEmailLog_reservationId_key" ON "ProgressEmailLog"("reservationId");
CREATE INDEX IF NOT EXISTS "ProgressEmailLog_userId_idx" ON "ProgressEmailLog"("userId");

CREATE TABLE IF NOT EXISTS "ProgressEmailOptOut" (
  "userId"    TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressEmailOptOut_pkey" PRIMARY KEY ("userId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgressEmailLog_reservationId_fkey') THEN
    ALTER TABLE "ProgressEmailLog"
      ADD CONSTRAINT "ProgressEmailLog_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgressEmailLog_userId_fkey') THEN
    ALTER TABLE "ProgressEmailLog"
      ADD CONSTRAINT "ProgressEmailLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgressEmailOptOut_userId_fkey') THEN
    ALTER TABLE "ProgressEmailOptOut"
      ADD CONSTRAINT "ProgressEmailOptOut_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
