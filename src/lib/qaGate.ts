// Bloqueo del sitio de QA con HTTP Basic Auth (contraseña compartida).
// Sin imports de Node: corre en el middleware (Edge runtime).

export type QaGateDecision = 'allow' | 'challenge'

export interface QaGateInput {
  pathname: string
  authorization: string | null
  password: string | undefined
  qa: boolean
}

// Rutas que llaman servicios externos (PayWay, Facturo, cron de Vercel) y no
// pueden mandar la contraseña. Coincidencia exacta o por segmento completo.
const EXEMPT_ROUTES = [
  '/api/payments/payway/callback',
  '/api/payments/payway/denied',
  '/api/webhooks/facturador',
]

// Archivos sueltos de /public (más favicon.ico y robots.txt, para que los
// crawlers lean el `Disallow` de QA). Coincidencia exacta.
const EXEMPT_FILES = [
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/manifest.json',
  '/sw.js',
  '/offline.html',
  '/robots.txt',
]

// Prefijos exentos: todo lo que cuelga de ellos (con la barra final incluida,
// para que `/api/cron-falso` o `/images-falso` no queden exentos). `/images/`
// hace falta además porque el optimizador de next/image (/_next/image) pide
// el original sin el header Basic.
const EXEMPT_PREFIXES = ['/api/cron/', '/_next/', '/images/']

// /public/halloween comparte carpeta con las páginas /halloween/...: ahí solo
// se exentan imágenes de un nivel (p. ej. /halloween/telon.jpg).
const HALLOWEEN_IMAGE = /^\/halloween\/[^/]+\.(?:jpe?g|png|webp|gif|svg)$/i

function isExempt(pathname: string): boolean {
  if (EXEMPT_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (EXEMPT_FILES.includes(pathname)) return true
  if (HALLOWEEN_IMAGE.test(pathname)) return true
  return EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

// Devuelve la contraseña del header `Basic`, o null si el header no sirve.
function passwordFromHeader(authorization: string | null): string | null {
  if (!authorization) return null
  const match = /^Basic\s+(\S+)\s*$/i.exec(authorization)
  if (!match) return null
  let decoded: string
  try {
    const binary = atob(match[1])
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    decoded = new TextDecoder().decode(bytes)
  } catch {
    return null
  }
  const sep = decoded.indexOf(':')
  if (sep === -1) return null
  // Cualquier usuario vale; la contraseña es todo lo que sigue al primer `:`.
  return decoded.slice(sep + 1)
}

// Comparación de tiempo (casi) constante para no filtrar la contraseña por tiempos.
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1))
  }
  return diff === 0
}

export function qaGateDecision(input: QaGateInput): QaGateDecision {
  if (!input.qa) return 'allow'
  if (isExempt(input.pathname)) return 'allow'
  // Fallar cerrado: QA sin contraseña configurada no deja entrar a nadie.
  if (!input.password) return 'challenge'
  const given = passwordFromHeader(input.authorization)
  if (given === null) return 'challenge'
  return safeEqual(given, input.password) ? 'allow' : 'challenge'
}
