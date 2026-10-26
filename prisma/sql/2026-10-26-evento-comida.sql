-- Pedidos de comida de un evento (Carne Calle en The Villains Ball).
--
-- Correr con POSTGRES_URL (conexión directa). NO usar prisma db push:
-- borra el índice único parcial "Purchase_gateway_provider_id_key" creado a mano.
--
-- Idempotente: se puede correr más de una vez sin efectos. Solo crea; no toca datos.

CREATE TABLE IF NOT EXISTS "EventFoodOrder" (
  "id"            TEXT         NOT NULL,
  "eventId"       TEXT         NOT NULL,
  "customerName"  TEXT         NOT NULL,
  "customerPhone" TEXT,
  "items"         JSONB        NOT NULL,
  "totalCents"    INTEGER      NOT NULL,
  "note"          TEXT,
  "paidAt"        TIMESTAMP(3),
  "deliveredAt"   TIMESTAMP(3),
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFoodOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventFoodOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EventFoodOrder_eventId_createdAt_idx" ON "EventFoodOrder"("eventId", "createdAt");

-- Verificación: debe devolver 1.
SELECT count(*) AS tabla_creada FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'EventFoodOrder';
