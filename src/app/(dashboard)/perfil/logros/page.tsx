'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { BadgeArt } from '@/components/badges/BadgeArt'
import { BadgeDetail } from '@/components/badges/BadgeDetail'
import { BadgeGrid } from '@/components/badges/BadgeGrid'
import { recentBadges } from '@/lib/progress/badges/evaluate'
import { challengeStatusText, progressRatio, sectionBadges } from '@/lib/progress/badges/display'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type BadgeCategory,
  type BadgeState,
  type BadgesResponse,
  type CurrentChallenge,
} from '@/lib/progress/badges/types'
import { plural } from '@/lib/progress/display'

const RECENT_COUNT = 6
const EMPTY_INTRO = 'Cada clase suma. Tu primera insignia está a una clase de distancia.'

/** Qué mide cada vitrina, en una línea. */
const CATEGORY_HINTS: Record<BadgeCategory, string> = {
  clases: 'Todas las clases a las que has asistido.',
  disciplinas: 'Tus clases en cada disciplina.',
  constancia: 'Tu mejor racha de semanas seguidas con al menos una clase.',
  semanas: 'Semanas en las que sumaste 150 minutos activos.',
  reto: 'Una meta personal cada mes, a tu ritmo. Aquí quedan los que cumpliste.',
  exploradora: 'Disciplinas distintas que has probado.',
  calma: 'Minutos de calma acumulados en tus clases.',
  momentos: 'Horarios, días y fechas especiales.',
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: BadgesResponse }

export default function LogrosPage() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = React.useState<BadgeState | null>(null)

  const fetchBadges = React.useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const response = await fetch('/api/user/badges')
      if (!response.ok) {
        setState({ status: 'error' })
        return
      }
      const data: BadgesResponse = await response.json()
      setState({ status: 'ready', data })
    } catch (error) {
      console.error('Error fetching badges:', error)
      setState({ status: 'error' })
    }
  }, [])

  React.useEffect(() => {
    fetchBadges()
  }, [fetchBadges])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Cargando tus logros…</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Mis logros</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No pudimos cargar tus logros. Revisa tu conexión e intenta de nuevo.</p>
            <button
              onClick={fetchBadges}
              className="text-sm font-medium text-primary-600 underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { badges, challenge, earnedCount } = state.data
  const recent = recentBadges(badges, RECENT_COUNT)

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Mis logros</h1>
        <p className="mt-1 text-gray-600">
          {earnedCount > 0 ? `${plural(earnedCount, 'logro ganado', 'logros ganados')}, clase a clase` : EMPTY_INTRO}
        </p>
      </header>

      <ChallengeHero challenge={challenge} onSelect={setSelected} />

      {earnedCount === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-primary-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            Tus insignias se encienden solas cuando asistes a clase. Toca cualquiera para ver qué la desbloquea.
          </p>
          <Button asChild size="sm">
            <Link href="/reservar">Reservar una clase</Link>
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="logros-recientes">
          <h2 id="logros-recientes" className="text-xl font-semibold text-foreground">
            Recientes
          </h2>
          <div className="mt-3 rounded-3xl border border-beige bg-white p-3 sm:p-4">
            <BadgeGrid badges={recent} onSelect={setSelected} layout="row" label="Logros recientes" />
          </div>
        </section>
      )}

      {CATEGORY_ORDER.map((category) => (
        <CategorySection key={category} category={category} badges={badges} onSelect={setSelected} />
      ))}

      <BadgeDetail badge={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function ChallengeHero({
  challenge,
  onSelect,
}: {
  challenge: CurrentChallenge
  onSelect: (badge: BadgeState) => void
}) {
  const idSuffix = React.useId()
  const earned = challenge.earnedAt !== null
  const ratio = progressRatio(challenge)

  return (
    <section
      aria-labelledby="reto-del-mes"
      className="relative overflow-hidden rounded-[28px] px-6 py-8 text-[#FFF8EF] sm:px-10"
      style={{
        background:
          'radial-gradient(circle at 20% 50%, rgba(196,167,125,0.42) 0%, rgba(196,167,125,0) 52%), linear-gradient(135deg, #4E443B 0%, #453C34 55%, #3A322B 100%)',
      }}
    >
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
        <button
          type="button"
          onClick={() => onSelect(challenge)}
          aria-haspopup="dialog"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF8EF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#453C34]"
        >
          <BadgeArt
            badge={challenge}
            size={168}
            progress={earned ? undefined : ratio}
            idSuffix={idSuffix}
            animate
          />
          <span className="sr-only">Ver el detalle del reto</span>
        </button>

        <div className="w-full max-w-md text-center sm:text-left">
          <p className="text-sm font-medium text-[#C4A77D]">Reto del mes</p>
          <h2 id="reto-del-mes" className="mt-1 text-3xl font-semibold">
            {challenge.title}
          </h2>
          <p className="mt-2 text-[#E8E0D4]">
            {earned
              ? `Tu meta era ${plural(challenge.target, 'clase', 'clases')} y la cumpliste.`
              : `Tu meta personal: ${plural(challenge.target, 'clase', 'clases')} este mes.`}
          </p>

          <div
            className="mt-5 h-2.5 overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(255,248,239,0.16)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={challenge.target}
            aria-valuenow={challenge.current}
            aria-label="Avance del reto"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
                background: 'linear-gradient(90deg, #C4A77D 0%, #F2DEBE 100%)',
              }}
            />
          </div>
          <p className="mt-3 text-sm font-medium">{challengeStatusText(challenge)}</p>
          <p className="mt-1 text-xs text-[#C4A77D]">La meta se ajusta a tu ritmo de los últimos tres meses.</p>
        </div>
      </div>
    </section>
  )
}

function CategorySection({
  category,
  badges,
  onSelect,
}: {
  category: BadgeCategory
  badges: BadgeState[]
  onSelect: (badge: BadgeState) => void
}) {
  const list = sectionBadges(badges, category)
  const earned = list.filter((b) => b.earnedAt !== null).length
  const headingId = `logros-${category}`
  // "Clases" no tiene final y "Reto" solo muestra los cumplidos: ahí se cuenta lo ganado.
  const count =
    category === 'clases'
      ? plural(earned, 'ganado', 'ganados')
      : category === 'reto'
        ? plural(earned, 'cumplido', 'cumplidos')
        : `${earned} de ${list.length}`

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-xl font-semibold text-foreground">
          {CATEGORY_LABELS[category]}
        </h2>
        <span className="shrink-0 text-sm text-gray-600">{count}</span>
      </div>
      <p className="mt-0.5 text-sm text-gray-600">{CATEGORY_HINTS[category]}</p>
      <div className="mt-3 rounded-3xl border border-beige bg-white p-3 sm:p-4">
        {list.length > 0 ? (
          <BadgeGrid badges={list} onSelect={onSelect} label={CATEGORY_LABELS[category]} />
        ) : (
          <p className="px-2 py-6 text-center text-sm text-gray-600">
            Cuando cumplas tu primer reto del mes, su emblema quedará guardado aquí.
          </p>
        )}
      </div>
    </section>
  )
}
