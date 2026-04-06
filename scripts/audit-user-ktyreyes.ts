import { PrismaClient } from '@prisma/client'
import { format, toZonedTime } from 'date-fns-tz'

const TZ = 'America/El_Salvador'
const prisma = new PrismaClient()

function fmtDate(d: Date | null | undefined): string {
  if (!d) return 'N/A'
  const zoned = toZonedTime(d, TZ)
  return format(zoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: TZ }) + ' (SV)'
}

async function main() {
  const email = 'ktyreyes@live.com'

  // 1. User data
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
      sessions: true,
    },
  })

  if (!user) {
    console.log(`\n❌ Usuario con email ${email} NO ENCONTRADO en la base de datos.\n`)
    return
  }

  // 2. Purchases with package info
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    include: { package: true },
    orderBy: { createdAt: 'desc' },
  })

  // 3. Recent reservations
  const reservations = await prisma.reservation.findMany({
    where: { userId: user.id },
    include: {
      class: {
        include: {
          instructor: true,
          discipline: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // 4. Orders
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { package: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // 5. Password reset tokens
  const resetTokens = await prisma.passwordResetToken.findMany({
    where: { email },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // 6. Verification tokens
  const verificationTokens = await prisma.verificationToken.findMany({
    where: { identifier: email },
    orderBy: { expires: 'desc' },
    take: 5,
  })

  // 7. Promo redemptions
  const promoRedemptions = await prisma.promoRedemption.findMany({
    where: { userId: user.id },
    include: { discountCode: true },
    orderBy: { redeemedAt: 'desc' },
  })

  // 8. Waitlist entries
  const waitlist = await prisma.waitlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // Print report
  console.log(`
===============================================
AUDITORÍA DE CUENTA: ${email}
===============================================

--- DATOS DE USUARIO ---
ID:              ${user.id}
Nombre:          ${user.name}
Email:           ${user.email}
Rol:             ${user.role}
Teléfono:        ${user.phone || 'N/A'}
Documento:       ${user.documentType ? `${user.documentType}: ${user.documentId}` : 'N/A'}
QR Code:         ${user.qrCode}
Creado:          ${fmtDate(user.createdAt)}
Actualizado:     ${fmtDate(user.updatedAt)}
Email verificado: ${user.emailVerified ? fmtDate(user.emailVerified) : 'NO VERIFICADO'}
Tiene password:  ${user.password ? 'Sí' : 'No (solo OAuth)'}
Profile Image:   ${user.profileImage || 'N/A'}

--- FLAGS DE ESTADO (TODOS los campos del registro) ---
⚠️  El modelo User NO tiene campos de bloqueo (blocked, suspended,
    active, status, isActive, lockedAt, failedLoginAttempts).
    No existe mecanismo de bloqueo a nivel de base de datos.

--- AUTENTICACIÓN ---
Sistema de auth:     NextAuth.js con CredentialsProvider (JWT strategy)
Email verificado:    ${user.emailVerified ? `Sí — ${fmtDate(user.emailVerified)}` : 'NO'}
Cuentas OAuth:       ${user.accounts.length > 0 ? user.accounts.map(a => `${a.provider} (${a.providerAccountId})`).join(', ') : 'Ninguna'}
Sesiones en DB:      ${user.sessions.length} (JWT strategy = sesiones no se guardan en DB normalmente)
${user.sessions.length > 0 ? user.sessions.map(s => `  - Token: ${s.sessionToken.substring(0, 20)}... | Expira: ${fmtDate(s.expires)}`).join('\n') : ''}
Intentos fallidos:   N/A (no hay tracking de intentos fallidos en el sistema)
Cuenta bloqueada:    NO a nivel DB (no existen campos de bloqueo)
Bloqueo por código:  NO (middleware solo verifica token JWT y rol ADMIN)

--- TOKENS DE VERIFICACIÓN ---
${verificationTokens.length > 0
    ? verificationTokens.map(t => `  - Token: ${t.token.substring(0, 20)}... | Expira: ${fmtDate(t.expires)}`).join('\n')
    : '  Ninguno encontrado'}

--- TOKENS DE RESET DE PASSWORD ---
${resetTokens.length > 0
    ? resetTokens.map(t => `  - Creado: ${fmtDate(t.createdAt)} | Expira: ${fmtDate(t.expiresAt)} | Usado: ${t.used ? 'Sí' : 'No'}`).join('\n')
    : '  Ninguno encontrado'}

--- PAQUETES / COMPRAS (Purchases) ---
${purchases.length > 0
    ? purchases.map(p => {
        const now = new Date()
        const isExpired = p.expiresAt < now
        const effectiveStatus = p.status === 'ACTIVE' && isExpired ? 'EXPIRED (no actualizado)' : p.status
        return `  📦 ${p.package.name}
     ID Compra:        ${p.id}
     Clases restantes: ${p.classesRemaining} / ${p.package.classCount}
     Precio original:  $${p.originalPrice.toFixed(2)}
     Precio final:     $${p.finalPrice.toFixed(2)}
     Código descuento: ${p.discountCode || 'N/A'}
     Estado:           ${effectiveStatus}
     Expira:           ${fmtDate(p.expiresAt)}${isExpired ? ' ⚠️ EXPIRADO' : ''}
     Creado:           ${fmtDate(p.createdAt)}
     Payment ID:       ${p.paymentProviderId || 'N/A (gratuito o pendiente)'}
     Factura:          ${p.invoiceStatus || 'N/A'}`
      }).join('\n\n')
    : '  No tiene compras registradas'}

--- ÓRDENES ---
${orders.length > 0
    ? orders.map(o => `  🛒 Orden ${o.id}
     Estado:     ${o.status}
     Total:      $${o.total.toFixed(2)}
     Creada:     ${fmtDate(o.createdAt)}
     Items:      ${o.items.map(i => `${i.package.name} x${i.quantity} ($${i.unitPrice.toFixed(2)})`).join(', ')}`
    ).join('\n\n')
    : '  No tiene órdenes registradas'}

--- CÓDIGOS PROMOCIONALES USADOS ---
${promoRedemptions.length > 0
    ? promoRedemptions.map(pr => `  🏷️  Código: ${pr.discountCode.code} | Estado: ${pr.status} | Fecha: ${fmtDate(pr.redeemedAt)}`).join('\n')
    : '  Ninguno'}

--- RESERVACIONES RECIENTES ---
${reservations.length > 0
    ? reservations.map(r => {
        const className = r.class.discipline?.name || r.class.classType || 'N/A'
        return `  📅 ${fmtDate(r.class.dateTime)} | ${className}${r.class.classType ? ' — ' + r.class.classType : ''} | Instructor: ${r.class.instructor?.name || 'N/A'} | Estado: ${r.status}${r.checkedIn ? ' ✅ Check-in' : ''}${r.cancelledAt ? ` | Cancelada: ${fmtDate(r.cancelledAt)}` : ''}`
      }).join('\n')
    : '  No tiene reservaciones'}

--- LISTA DE ESPERA ---
${waitlist.length > 0
    ? waitlist.map(w => `  ⏳ Clase: ${w.classId} | Fecha unión: ${fmtDate(w.createdAt)}`).join('\n')
    : '  Ninguna'}

--- DIAGNÓSTICO ---
`)

  // Diagnostic analysis
  const diagnostics: string[] = []
  const actions: string[] = []

  // Check email verification
  if (!user.emailVerified) {
    diagnostics.push('Email NO verificado — NextAuth puede requerir verificación dependiendo de la config.')
  }

  // Check if user has password
  if (!user.password) {
    diagnostics.push('Usuario NO tiene password — solo puede autenticarse via OAuth.')
    if (user.accounts.length === 0) {
      diagnostics.push('⚠️ CRÍTICO: No tiene password NI cuentas OAuth. No puede iniciar sesión.')
      actions.push('Investigar cómo se creó esta cuenta sin método de autenticación.')
    }
  }

  // Check active packages
  const now = new Date()
  const activePurchases = purchases.filter(p => p.status === 'ACTIVE' && p.expiresAt > now && p.classesRemaining > 0)
  const expiredButActive = purchases.filter(p => p.status === 'ACTIVE' && p.expiresAt < now)

  if (activePurchases.length === 0) {
    diagnostics.push('No tiene paquetes activos con clases disponibles.')
    if (expiredButActive.length > 0) {
      diagnostics.push(`Tiene ${expiredButActive.length} paquete(s) marcados como ACTIVE pero ya expirados (status no actualizado).`)
    }
  }

  // Check trial package restriction
  const TRIAL_PACKAGE_ID = 'cmm78xhwt0000bfage9rlmp2m'
  const trialPurchases = purchases.filter(p => p.packageId === TRIAL_PACKAGE_ID)
  if (trialPurchases.length > 0) {
    diagnostics.push(`Tiene paquete trial/introductorio. Desde 2026-03-09, este paquete no permite reservar clases nuevas.`)
  }

  // Summary
  if (diagnostics.length === 0) {
    diagnostics.push('No se encontró causa obvia de bloqueo a nivel técnico.')
  }

  // Suggested actions
  if (!user.password && user.accounts.length === 0) {
    actions.push('Resetear password manualmente o crear enlace de reset.')
  }
  if (!user.emailVerified) {
    actions.push('Verificar email de la usuaria (marcar emailVerified en DB o enviar token de verificación).')
  }
  if (activePurchases.length === 0 && purchases.length > 0) {
    actions.push('Si la usuaria necesita acceso, considerar extender vigencia de paquete o asignar uno nuevo.')
  }
  actions.push('Preguntar a la usuaria qué error específico ve al intentar acceder (screenshot si es posible).')
  actions.push('Verificar si el problema es de contraseña olvidada — enviar enlace de reset de password.')
  actions.push('Revisar logs de Vercel para errores 401/403 asociados a este email.')

  console.log(`Causa probable del bloqueo:`)
  diagnostics.forEach((d, i) => console.log(`  ${i + 1}. ${d}`))
  console.log(`\nAcciones sugeridas:`)
  actions.forEach((a, i) => console.log(`  ${i + 1}. ${a}`))
  console.log(`\n===============================================`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
