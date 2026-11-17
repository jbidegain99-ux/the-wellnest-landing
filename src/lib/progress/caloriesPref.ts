// Preferencia "Mostrar calorías estimadas", guardada en el dispositivo.
// Apagada por defecto: cualquier fallo de localStorage (modo privado, cuota,
// bloqueo de cookies) se trata como "apagada" y nunca rompe la página.

export const SHOW_CALORIES_KEY = 'wellnest:progreso:mostrarCalorias'

/** Lo mínimo de `Storage` que se usa; permite probar sin navegador. */
export interface PrefStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): PrefStorage | null {
  try {
    const s = globalThis.localStorage
    return s && typeof s.getItem === 'function' ? s : null
  } catch {
    // Acceder a localStorage puede lanzar (p. ej. cookies bloqueadas).
    return null
  }
}

export function readShowCalories(storage: PrefStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(SHOW_CALORIES_KEY) === '1'
  } catch {
    return false
  }
}

export function writeShowCalories(
  value: boolean,
  storage: PrefStorage | null = browserStorage()
): void {
  if (!storage) return
  try {
    storage.setItem(SHOW_CALORIES_KEY, value ? '1' : '0')
  } catch {
    // Sin persistencia: la preferencia dura solo mientras la página esté abierta.
  }
}
