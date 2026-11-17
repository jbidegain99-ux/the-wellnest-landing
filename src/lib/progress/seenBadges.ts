// Logros ya celebrados en este dispositivo, guardados en localStorage.
// Cualquier fallo de almacenamiento (modo privado, cookies bloqueadas, cuota)
// se trata como "sin clave" al leer y como "no se guardó" al escribir.

export const SEEN_BADGES_KEY = 'wellnest:logros:vistos'
/** Primera vez en el dispositivo: lo ganado hace más de esto se da por visto. */
export const FIRST_VISIT_DAYS = 7

const DAY_MS = 24 * 3600 * 1000

/** Lo mínimo de `Storage` que se usa; permite probar sin navegador. */
export interface SeenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): SeenStorage | null {
  try {
    const s = globalThis.localStorage
    return s && typeof s.getItem === 'function' ? s : null
  } catch {
    // Acceder a localStorage puede lanzar (p. ej. cookies bloqueadas).
    return null
  }
}

/**
 * Ids de logros ganados que este dispositivo no ha visto, lo más nuevo primero.
 * Sin clave (`seen === null`), lo ganado hace más de 7 días cuenta como visto:
 * así al lanzar no se celebran decenas de logros de golpe.
 */
export function unseenBadges(earned: { id: string; earnedAt: string }[], seen: string[] | null, now: Date): string[] {
  const since = now.getTime() - FIRST_VISIT_DAYS * DAY_MS
  const seenSet = new Set(seen ?? [])
  return earned
    .filter((b) => (seen === null ? new Date(b.earnedAt).getTime() >= since : !seenSet.has(b.id)))
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
    .map((b) => b.id)
}

/** Lista guardada, o `null` si no hay clave, está dañada o no se puede leer. */
export function readSeen(storage: SeenStorage | null = browserStorage()): string[] | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(SEEN_BADGES_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

/** Guarda la lista; `false` si no se pudo (la página sigue igual). */
export function writeSeen(ids: string[], storage: SeenStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(SEEN_BADGES_KEY, JSON.stringify(ids))
    return true
  } catch {
    return false
  }
}

/**
 * Lista a guardar tras marcar `markIds` como vistos. Sin clave, parte de lo que
 * ya se da por visto. Solo conserva ids de `earned` (los recientes): lo que salió
 * de esa ventana no vuelve a entrar, así la lista no crece sin fin.
 */
export function nextSeenList(
  seen: string[] | null,
  earned: { id: string; earnedAt: string }[],
  markIds: string[],
  now: Date
): string[] {
  const ids = earned.map((b) => b.id)
  let base: string[]
  if (seen === null) {
    const unseen = new Set(unseenBadges(earned, null, now))
    base = ids.filter((id) => !unseen.has(id))
  } else {
    const recentIds = new Set(ids)
    base = seen.filter((id) => recentIds.has(id))
  }
  return Array.from(new Set([...base, ...markIds]))
}
