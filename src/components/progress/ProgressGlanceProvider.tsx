'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import type { ProgressGlance } from '@/lib/progress/glance'
import { nextSeenList, readSeen, unseenBadges, writeSeen } from '@/lib/progress/seenBadges'

interface ProgressGlanceValue {
  glance: ProgressGlance | null
  loading: boolean
  /** Ids de logros recientes que este dispositivo no ha visto, lo más nuevo primero. */
  unseen: string[]
  /** Guarda esos ids como vistos (y quita el punto del Navbar). */
  markSeen: (ids: string[]) => void
  /** Vuelve a pedir el vistazo (p. ej. tras registrar una asistencia). */
  refresh: () => void
}

const EMPTY: ProgressGlanceValue = {
  glance: null,
  loading: false,
  unseen: [],
  markSeen: () => {},
  refresh: () => {},
}

const ProgressGlanceContext = React.createContext<ProgressGlanceValue>(EMPTY)

/** Estado de "vistos" en este dispositivo. `storageOk` = se pudo guardar. */
interface SeenState {
  ready: boolean
  list: string[] | null
  storageOk: boolean
}

/**
 * Pide `GET /api/user/progress/glance` una vez por carga de página cuando hay
 * sesión, y lo comparte con el Navbar, la franja de la home y la celebración.
 * Si falla, `glance` queda en null y nada se muestra.
 */
export function ProgressGlanceProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [glance, setGlance] = React.useState<ProgressGlance | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [seen, setSeen] = React.useState<SeenState>({ ready: false, list: null, storageOk: true })

  React.useEffect(() => {
    if (status !== 'authenticated') {
      setGlance(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/user/progress/glance', { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`glance ${res.status}`)
        const body = (await res.json()) as ProgressGlance
        setGlance(body)
        setLoadedAt(new Date())
      })
      .catch(() => {
        if (!controller.signal.aborted) setGlance(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [status, reloadKey])

  // Primera vez con el vistazo: se lee la clave del dispositivo. Sin clave, lo
  // ganado hace más de 7 días queda guardado como visto. Si no se puede guardar
  // (modo privado, almacenamiento bloqueado), no se celebra ni se marca nada:
  // si no, la celebración volvería en cada carga.
  React.useEffect(() => {
    if (!glance || !loadedAt || seen.ready) return
    const stored = readSeen()
    if (stored !== null) {
      setSeen({ ready: true, list: stored, storageOk: true })
      return
    }
    const initial = nextSeenList(null, glance.recentBadges, [], loadedAt)
    const ok = writeSeen(initial)
    setSeen({ ready: true, list: initial, storageOk: ok })
  }, [glance, loadedAt, seen.ready])

  const unseen = React.useMemo(() => {
    if (!glance || !loadedAt || !seen.ready || !seen.storageOk) return []
    return unseenBadges(glance.recentBadges, seen.list, loadedAt)
  }, [glance, loadedAt, seen])

  const markSeen = React.useCallback(
    (ids: string[]) => {
      if (!glance || !loadedAt || ids.length === 0) return
      const list = nextSeenList(seen.list, glance.recentBadges, ids, loadedAt)
      writeSeen(list)
      setSeen((prev) => ({ ...prev, ready: true, list }))
    },
    [glance, loadedAt, seen.list]
  )

  const refresh = React.useCallback(() => setReloadKey((k) => k + 1), [])

  const value = React.useMemo<ProgressGlanceValue>(
    () => ({ glance, loading, unseen, markSeen, refresh }),
    [glance, loading, unseen, markSeen, refresh]
  )

  return <ProgressGlanceContext.Provider value={value}>{children}</ProgressGlanceContext.Provider>
}

export function useProgressGlance(): ProgressGlanceValue {
  return React.useContext(ProgressGlanceContext)
}
