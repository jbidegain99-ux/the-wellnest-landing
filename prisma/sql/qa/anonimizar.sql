-- Anonimiza la copia de producción restaurada en la base de QA.
--
-- SOLO PARA QA. Destruye los datos personales de las clientas de forma irreversible:
-- correrlo contra producción borraría nombres, correos y contraseñas reales.
-- Lo corre scripts/qa-refresh.sh justo después de pg_restore; no correrlo a mano.
--
-- Requiere la variable psql qa_password_hash (hash bcrypt de la contraseña común de QA).
-- qa-refresh.sh la pasa por un -f previo con \set (no aparece en `ps`); a mano sería:
--   psql -v qa_password_hash='$2b$10$...' -f prisma/sql/qa/anonimizar.sql "$QA_URL"
--
-- Se conserva: paquetes, compras (montos), reservas, asistencias, clases, horarios,
-- instructoras (staff: nombres públicos), eventos y las cuentas ADMIN con su correo real.
-- Cada columna con datos personales del schema está listada abajo; si agregas una
-- columna con nombre, correo, teléfono, documento, dirección, texto libre de una clienta
-- o un token, agrégala aquí y en verificar.sql.

\set ON_ERROR_STOP on

\if :{?qa_password_hash}
\else
  \echo 'ERROR: falta la variable qa_password_hash (hash bcrypt de la contraseña de QA).'
  DO $$ BEGIN RAISE EXCEPTION 'falta qa_password_hash: no se anonimizó nada'; END $$;
\endif

BEGIN;

-- El hash viaja como ajuste local de la transacción (se descarta al COMMIT).
SELECT set_config('qa.password_hash', :'qa_password_hash', true) IS NOT NULL AS hash_recibido \gset

DO $$
BEGIN
  IF current_setting('qa.password_hash') !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'qa_password_hash no parece un hash bcrypt ($2b$10$ + 53 caracteres)';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- User
-- ---------------------------------------------------------------------------

-- Fase 1: correo provisional único por id, para que la numeración final no choque
-- con el índice único de email mientras se reasigna.
UPDATE "User"
SET "email" = 'tmp-' || "id" || '@qa.wellneststudio.net'
WHERE "role" <> 'ADMIN';

-- Fase 2: "Usuaria N" / usuariaN@qa.wellneststudio.net, N por fecha de creación.
-- qrCode se regenera: el de producción sirve para hacer check-in en el estudio real.
UPDATE "User" u
SET "name"          = 'Usuaria ' || s.n,
    "email"         = 'usuaria' || s.n || '@qa.wellneststudio.net',
    "phone"         = NULL,
    "documentId"    = NULL,
    "documentType"  = NULL,
    "fiscalAddress" = NULL,
    "birthDate"     = NULL,
    "gender"        = NULL,
    "height"        = NULL,
    "weight"        = NULL,
    "profileImage"  = NULL,
    "qrCode"        = 'qa' || substr(md5(random()::text || u."id"), 1, 23)
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "User"
  WHERE "role" <> 'ADMIN'
) s
WHERE u."id" = s."id";

-- Todas las cuentas (ADMIN incluidas) entran con la contraseña común de QA.
UPDATE "User" SET "password" = current_setting('qa.password_hash');

-- ---------------------------------------------------------------------------
-- Autenticación: tokens y sesiones
-- ---------------------------------------------------------------------------

-- Solo hay login con credenciales; las filas de Account que existan son legado.
UPDATE "Account"
SET "access_token"      = NULL,
    "refresh_token"     = NULL,
    "id_token"          = NULL,
    "session_state"     = NULL,
    "providerAccountId" = 'qa-' || "id";

DELETE FROM "Session";
DELETE FROM "VerificationToken";
DELETE FROM "PasswordResetToken";

-- ---------------------------------------------------------------------------
-- Invitadas, referidos, contacto
-- ---------------------------------------------------------------------------

UPDATE "Reservation" r
SET "guestEmail" = CASE WHEN r."guestEmail" IS NULL THEN NULL
                        ELSE 'invitada' || s.n || '@qa.wellneststudio.net' END,
    "guestName"  = CASE WHEN r."guestName" IS NULL THEN NULL
                        ELSE 'Invitada QA ' || s.n END,
    -- token del enlace de aceptar/rechazar invitación (secreto)
    "guestToken" = CASE WHEN r."guestToken" IS NULL THEN NULL
                        ELSE md5(random()::text || r."id") || md5(random()::text || r."id") END
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "Reservation"
  WHERE "guestEmail" IS NOT NULL OR "guestName" IS NOT NULL OR "guestToken" IS NOT NULL
) s
WHERE r."id" = s."id";

UPDATE "Referral"
SET "referredEmail" = 'referida-' || "id" || '@qa.wellneststudio.net'
WHERE "referredEmail" IS NOT NULL;

UPDATE "ContactMessage" c
SET "name"    = 'Contacto QA ' || s.n,
    "email"   = 'contacto' || s.n || '@qa.wellneststudio.net',
    "phone"   = NULL,
    "subject" = 'Consulta QA ' || s.n,
    "message" = 'Mensaje anonimizado (QA).'
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "ContactMessage"
) s
WHERE c."id" = s."id";

-- ---------------------------------------------------------------------------
-- Pagos y facturación
-- ---------------------------------------------------------------------------

UPDATE "PaymentTransaction"
SET "cardHolder"     = NULL,
    "rawPayload"     = NULL,
    "cardLastDigits" = CASE WHEN "cardLastDigits" IS NULL THEN NULL ELSE '0000' END;

UPDATE "PaymentMethod"
SET "last4"                 = '0000',
    "stripePaymentMethodId" = 'pm_qa_' || "id";

-- invoiceUrl apunta al PDF del DTE (lleva nombre y documento del receptor);
-- invoiceError puede repetir datos del receptor que devolvió el facturador.
UPDATE "Purchase"
SET "invoiceUrl"   = NULL,
    "invoiceError" = CASE WHEN "invoiceError" IS NULL THEN NULL ELSE 'Error anonimizado (QA)' END
WHERE "invoiceUrl" IS NOT NULL OR "invoiceError" IS NOT NULL;

UPDATE "webhook_logs"
SET "payload" = '{}'::jsonb,
    "error"   = NULL;

-- ---------------------------------------------------------------------------
-- Texto libre sobre clientas (escrito por ellas o por el staff)
-- ---------------------------------------------------------------------------

UPDATE "PrivateSessionRequest"
SET "notes"          = NULL,
    "adminNotes"     = NULL,
    "rejectedReason" = CASE WHEN "rejectedReason" IS NULL THEN NULL ELSE 'Motivo anonimizado (QA)' END;

-- Las clases privadas son 1:1: sus notas suelen nombrar a la clienta.
UPDATE "Class" SET "notes" = NULL WHERE "isPrivate" AND "notes" IS NOT NULL;

UPDATE "RefundRequest" SET "notes" = NULL WHERE "notes" IS NOT NULL;

UPDATE "ExcludedPurchase" SET "notes" = NULL WHERE "notes" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Eventos con entrada
-- ---------------------------------------------------------------------------

-- Teléfono ficticio con formato E.164 (+5030…: ningún número real de SV empieza en 0).
UPDATE "EventOrder" o
SET "buyerName"   = 'Comprador QA ' || s.n,
    "buyerEmail"  = 'comprador' || s.n || '@qa.wellneststudio.net',
    "buyerPhone"  = '+5030' || lpad(s.n::text, 7, '0'),
    "adminNote"   = NULL,
    "accessToken" = md5(random()::text || o."id") || md5(random()::text || o."id")
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "EventOrder"
) s
WHERE o."id" = s."id";

UPDATE "EventTicket" t
SET "holderName"  = CASE WHEN t."holderName"  IS NULL THEN NULL ELSE 'Asistente QA ' || s.n END,
    "holderEmail" = CASE WHEN t."holderEmail" IS NULL THEN NULL
                         ELSE 'asistente' || s.n || '@qa.wellneststudio.net' END,
    "holderPhone" = CASE WHEN t."holderPhone" IS NULL THEN NULL
                         ELSE '+5030' || lpad(s.n::text, 7, '0') END,
    "token"       = md5(random()::text || t."id") || md5(random()::text || t."id")
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "EventTicket"
) s
WHERE t."id" = s."id";

COMMIT;
