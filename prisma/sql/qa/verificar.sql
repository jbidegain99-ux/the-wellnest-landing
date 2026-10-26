-- Verifica que la base de QA quedó anonimizada (correr después de anonimizar.sql).
--
-- Devuelve una fila por chequeo: chequeo | conteo. Todo conteo debe ser 0;
-- scripts/qa-refresh.sh falla si alguno no lo es. Solo lee.
--
-- "tablas_sin_revisar" cuenta tablas de public que nadie revisó para anonimizar:
-- si aparece una tabla nueva, revisar sus columnas, agregarla a anonimizar.sql si
-- tiene datos personales, y sumarla a la lista de abajo.

\set ON_ERROR_STOP on

SELECT 'usuarias_correo_no_qa' AS chequeo, count(*) AS conteo
  FROM "User"
  WHERE "role" <> 'ADMIN' AND "email" NOT LIKE '%@qa.wellneststudio.net'
UNION ALL
SELECT 'usuarias_nombre_no_anonimo', count(*)
  FROM "User"
  WHERE "role" <> 'ADMIN' AND "name" !~ '^Usuaria [0-9]+$'
UNION ALL
SELECT 'usuarias_con_datos_personales', count(*)
  FROM "User"
  WHERE "role" <> 'ADMIN'
    AND ("phone" IS NOT NULL OR "documentId" IS NOT NULL OR "documentType" IS NOT NULL
         OR "fiscalAddress" IS NOT NULL OR "birthDate" IS NOT NULL OR "gender" IS NOT NULL
         OR "height" IS NOT NULL OR "weight" IS NOT NULL OR "profileImage" IS NOT NULL)
UNION ALL
-- Todas las cuentas deben tener la misma contraseña (la de QA) y ninguna sin contraseña.
SELECT 'usuarias_sin_contrasena_qa',
       CASE WHEN count(*) = 0 THEN 0
            ELSE count(*) FILTER (WHERE "password" IS NULL)
                 + CASE WHEN count(DISTINCT "password") = 1 THEN 0 ELSE 1 END
       END
  FROM "User"
UNION ALL
SELECT 'cuentas_con_tokens', count(*)
  FROM "Account"
  WHERE "access_token" IS NOT NULL OR "refresh_token" IS NOT NULL OR "id_token" IS NOT NULL
     OR "session_state" IS NOT NULL OR "providerAccountId" NOT LIKE 'qa-%'
UNION ALL
SELECT 'sesiones', count(*) FROM "Session"
UNION ALL
SELECT 'tokens_verificacion', count(*) FROM "VerificationToken"
UNION ALL
SELECT 'tokens_reseteo_contrasena', count(*) FROM "PasswordResetToken"
UNION ALL
SELECT 'reservas_invitada_real', count(*)
  FROM "Reservation"
  WHERE "guestEmail" NOT LIKE '%@qa.wellneststudio.net'
     OR "guestName" !~ '^Invitada QA [0-9]+$'
UNION ALL
SELECT 'referidos_correo_real', count(*)
  FROM "Referral"
  WHERE "referredEmail" NOT LIKE '%@qa.wellneststudio.net'
UNION ALL
SELECT 'mensajes_contacto_reales', count(*)
  FROM "ContactMessage"
  WHERE "email" NOT LIKE '%@qa.wellneststudio.net' OR "phone" IS NOT NULL
     OR "name" !~ '^Contacto QA [0-9]+$' OR "message" <> 'Mensaje anonimizado (QA).'
UNION ALL
SELECT 'transacciones_con_titular_o_payload', count(*)
  FROM "PaymentTransaction"
  WHERE "cardHolder" IS NOT NULL OR "rawPayload" IS NOT NULL OR "cardLastDigits" <> '0000'
UNION ALL
SELECT 'metodos_pago_reales', count(*)
  FROM "PaymentMethod"
  WHERE "last4" <> '0000' OR "stripePaymentMethodId" NOT LIKE 'pm_qa_%'
UNION ALL
SELECT 'compras_con_factura_real', count(*)
  FROM "Purchase"
  WHERE "invoiceUrl" IS NOT NULL OR "invoiceError" <> 'Error anonimizado (QA)'
UNION ALL
SELECT 'webhooks_con_payload', count(*)
  FROM "webhook_logs"
  WHERE "payload" <> '{}'::jsonb OR "error" IS NOT NULL
UNION ALL
SELECT 'notas_libres_con_texto',
       (SELECT count(*) FROM "PrivateSessionRequest"
         WHERE "notes" IS NOT NULL OR "adminNotes" IS NOT NULL
            OR "rejectedReason" <> 'Motivo anonimizado (QA)')
     + (SELECT count(*) FROM "Class" WHERE "isPrivate" AND "notes" IS NOT NULL)
     + (SELECT count(*) FROM "RefundRequest" WHERE "notes" IS NOT NULL)
     + (SELECT count(*) FROM "ExcludedPurchase" WHERE "notes" IS NOT NULL)
UNION ALL
SELECT 'pedidos_evento_correo_no_qa', count(*)
  FROM "EventOrder"
  WHERE "buyerEmail" NOT LIKE '%@qa.wellneststudio.net'
UNION ALL
SELECT 'pedidos_evento_datos_reales', count(*)
  FROM "EventOrder"
  WHERE "buyerName" !~ '^Comprador QA [0-9]+$' OR "buyerPhone" !~ '^\+5030[0-9]{7}$'
     OR "adminNote" IS NOT NULL
UNION ALL
SELECT 'entradas_evento_datos_reales', count(*)
  FROM "EventTicket"
  WHERE "holderEmail" NOT LIKE '%@qa.wellneststudio.net'
     OR "holderName" !~ '^Asistente QA [0-9]+$'
     OR "holderPhone" !~ '^\+5030[0-9]{7}$'
UNION ALL
SELECT 'pedidos_comida_datos_reales', count(*)
  FROM "EventFoodOrder"
  WHERE "customerName" !~ '^Cliente QA [0-9]+$'
     OR "customerPhone" !~ '^\+5030[0-9]{7}$'
     OR "note" IS NOT NULL
UNION ALL
SELECT 'tablas_sin_revisar', count(*)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name NOT IN (
      -- revisadas: con datos personales (anonimizar.sql las trata)
      'User', 'Account', 'Session', 'VerificationToken', 'PasswordResetToken',
      'Reservation', 'Referral', 'ContactMessage', 'PaymentTransaction', 'PaymentMethod',
      'Purchase', 'webhook_logs', 'PrivateSessionRequest', 'Class', 'RefundRequest',
      'ExcludedPurchase', 'EventOrder', 'EventTicket', 'EventFoodOrder',
      -- revisadas: sin datos personales de clientas
      'Discipline', 'Instructor', 'Package', 'PackageDiscipline', 'Waitlist', 'DiscountCode',
      'BlogPost', 'GalleryImage', 'Testimonial', 'CartItem', 'NotificationSettings',
      'BrandAsset', 'PromoRedemption', 'SiteSettings', 'Order', 'OrderItem', 'Event',
      '_prisma_migrations',
      -- marca que identifica la base de QA (la crea José una vez; ver qa-refresh.sh)
      'qa_entorno'
    );
