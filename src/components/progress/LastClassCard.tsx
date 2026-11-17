'use client'

import * as React from 'react'
import Link from 'next/link'
import { Clock, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { ClassSummary, ProgressSummary } from '@/lib/progress/summary'
import { formatClassType, formatDate, formatTime } from '@/lib/utils'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; totalClasses: number; lastClass: ClassSummary | null }

/**
 * Atajo en /perfil: muestra la última clase asistida y enlaza a /perfil/progreso.
 * Nunca debe romper la página: ante cualquier error no renderiza nada.
 */
export function LastClassCard() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/user/progress')
        if (!response.ok) {
          if (!cancelled) setState({ status: 'error' })
          return
        }
        const data: ProgressSummary = await response.json()
        if (!cancelled) {
          setState({ status: 'ready', totalClasses: data.totalClasses, lastClass: data.lastClass })
        }
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'error') return null

  if (state.status === 'loading') {
    return <div className="h-32 rounded-xl bg-primary-50 animate-pulse" aria-hidden="true" />
  }

  if (!state.lastClass || state.totalClasses === 0) {
    return (
      <Card className="bg-gradient-to-br from-white to-primary-50">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100">
            <Sprout className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <p className="font-serif text-lg font-semibold text-foreground">
              Tu práctica empieza con una clase
            </p>
            <p className="text-sm text-gray-600">
              Reserva tu primera clase y aquí verás tu progreso.
            </p>
          </div>
          <Button asChild>
            <Link href="/reservar">Reservar una clase</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const last = state.lastClass
  const type = last.classType && last.classType !== 'regular' ? formatClassType(last.classType) : ''

  return (
    <Card className="bg-gradient-to-br from-white to-primary-50">
      <CardContent className="space-y-3 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-primary-600">
          Tu última clase
        </p>
        <div>
          <p className="font-serif text-xl font-semibold text-foreground">
            {last.disciplineName}
            {type && <span className="font-normal text-gray-600"> · {type}</span>}
          </p>
          <p className="text-sm text-gray-600">
            {formatDate(last.date)} · {formatTime(last.date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-foreground mr-2">
            <Clock className="h-4 w-4 text-primary-600" />
            {last.minutes} min
          </span>
          <ul className="flex flex-wrap gap-2" aria-label="Foco trabajado">
            {last.focus.map((f) => (
              <li key={f}>
                <Badge className="bg-white border border-beige-dark text-foreground">{f}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <Button asChild>
          <Link href="/perfil/progreso">Ver mi progreso</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
