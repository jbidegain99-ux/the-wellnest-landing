/**
 * Rate limiter de ventana fija en memoria.
 *
 * Limitación conocida: en serverless el estado vive por instancia caliente
 * (con Fluid Compute las instancias se reutilizan entre requests, así que en
 * la práctica frena fuerza bruta de forma efectiva, pero no es un límite
 * global exacto). Para un límite duro multi-instancia usar Vercel WAF o
 * Upstash; este helper es la línea base sin dependencias.
 */

interface WindowEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, WindowEntry>()
const MAX_ENTRIES = 10_000

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || entry.resetAt <= now) {
    // Poda básica para no crecer sin límite
    if (windows.size >= MAX_ENTRIES) {
      for (const [k, v] of Array.from(windows.entries())) {
        if (v.resetAt <= now) windows.delete(k)
      }
      if (windows.size >= MAX_ENTRIES) windows.clear()
    }
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

/** IP del request detrás del proxy de Vercel */
export function requestIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'unknown'
}

/** Resetea el contador (p.ej. tras un login exitoso) */
export function resetRateLimit(key: string): void {
  windows.delete(key)
}
