-- The Villains Ball: tablas de entradas (Event, EventOrder, EventTicket).
--
-- Correr con POSTGRES_URL (conexión directa). NO usar prisma db push:
-- borra el índice único parcial "Purchase_gateway_provider_id_key" creado a mano.
--
-- Idempotente: se puede correr más de una vez sin efectos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventOrderStatus') THEN
    CREATE TYPE "EventOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Event" (
  "id"         TEXT         NOT NULL,
  "slug"       TEXT         NOT NULL,
  "name"       TEXT         NOT NULL,
  "startsAt"   TIMESTAMP(3) NOT NULL,
  "endsAt"     TIMESTAMP(3) NOT NULL,
  "venue"      TEXT         NOT NULL,
  "priceCents" INTEGER      NOT NULL,
  "capacity"   INTEGER,
  "salesOpen"  BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Event_slug_key" ON "Event"("slug");

CREATE TABLE IF NOT EXISTS "EventOrder" (
  "id"             TEXT               NOT NULL,
  "eventId"        TEXT               NOT NULL,
  "code"           TEXT               NOT NULL,
  "accessToken"    TEXT               NOT NULL,
  "buyerName"      TEXT               NOT NULL,
  "buyerEmail"     TEXT               NOT NULL,
  "buyerPhone"     TEXT               NOT NULL,
  "quantity"       INTEGER            NOT NULL,
  "amountCents"    INTEGER            NOT NULL,
  "status"         "EventOrderStatus" NOT NULL DEFAULT 'PENDING',
  "marketingOptIn" BOOLEAN            NOT NULL DEFAULT true,
  "expiresAt"      TIMESTAMP(3)       NOT NULL,
  "paidAt"         TIMESTAMP(3),
  "confirmedById"  TEXT,
  "cancelledAt"    TIMESTAMP(3),
  "adminNote"      TEXT,
  "whatsappSentAt" TIMESTAMP(3),
  "buyerUserId"    TEXT,
  "createdAt"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventOrder_code_key" ON "EventOrder"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "EventOrder_accessToken_key" ON "EventOrder"("accessToken");
CREATE INDEX IF NOT EXISTS "EventOrder_eventId_status_idx" ON "EventOrder"("eventId", "status");

CREATE TABLE IF NOT EXISTS "EventTicket" (
  "id"             TEXT         NOT NULL,
  "orderId"        TEXT         NOT NULL,
  "eventId"        TEXT         NOT NULL,
  "seq"            INTEGER      NOT NULL,
  "token"          TEXT         NOT NULL,
  "holderName"     TEXT,
  "holderEmail"    TEXT,
  "holderPhone"    TEXT,
  "holderUserId"   TEXT,
  "marketingOptIn" BOOLEAN      NOT NULL DEFAULT false,
  "claimedAt"      TIMESTAMP(3),
  "checkedInAt"    TIMESTAMP(3),
  "checkedInById"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventTicket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EventOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventTicket_token_key" ON "EventTicket"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "EventTicket_orderId_seq_key" ON "EventTicket"("orderId", "seq");
CREATE INDEX IF NOT EXISTS "EventTicket_eventId_checkedInAt_idx" ON "EventTicket"("eventId", "checkedInAt");

INSERT INTO "Event" ("id", "slug", "name", "startsAt", "endsAt", "venue", "priceCents", "capacity", "salesOpen")
VALUES ('evt_villains_ball_2026', 'villains-ball', 'The Villains Ball', '2026-10-31 00:30:00', '2026-10-31 05:59:00', 'Plaza Presidente · Nivel 3 · San Salvador', 1000, NULL, true)
ON CONFLICT ("slug") DO NOTHING;
