'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Activity,
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  Leaf,
  Loader2,
  Sparkles,
  Sprout,
  Trophy,
  Wind,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProgressRing } from '@/components/progress/ProgressRing'
import { MixRadar } from '@/components/progress/MixRadar'
import { MonthBars } from '@/components/progress/MonthBars'
import { useShowCalories } from '@/components/progress/useShowCalories'
import { BadgeArt } from '@/components/badges/BadgeArt'
import { nextBadges, recentBadges } from '@/lib/progress/badges/evaluate'
import {
  badgeProgressText,
  challengeStatusText,
  formatBadgeDate,
  progressRatio,
} from '@/lib/progress/badges/display'
import type { BadgeState, BadgesResponse } from '@/lib/progress/badges/types'
import { AXIS_LABELS } from '@/lib/progress/profiles'
import {
  WEEKLY_TARGET_MINUTES,
  type ClassSummary,
  type ProgressSummary,
} from '@/lib/progress/summary'
import { monthDeltaText, monthFullName, plural, topAxes } from '@/lib/progress/display'
import { cn, formatClassType, formatDate, formatTime } from '@/lib/utils'

const SOUND_THERAPY_TEXT = 'Clase de calma: sin gasto activo'
const FOOTER_TEXT =
  'Estimaciones según el tipo y la duración de cada clase. No reemplazan una evaluación profesional.'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: ProgressSummary }

type BadgesLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: BadgesResponse }

export default function ProgresoPage() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })
  const [showCalories, setShowCalories] = useShowCalories()
  const [badgesState, setBadgesState] = React.useState<BadgesLoad>({ status: 'loading' })

  const fetchProgress = React.useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const response = await fetch('/api/user/progress')
      if (!response.ok) {
        // Un error del servidor NO significa "sin clases": se muestra como error.
        setState({ status: 'error' })
        return
      }
      const data: ProgressSummary = await response.json()
      setState({ status: 'ready', data })
    } catch (error) {
      console.error('Error fetching progress:', error)
      setState({ status: 'error' })
    }
  }, [])

  // Los logros se piden en paralelo; si fallan, solo su tarjeta muestra el error.
  const fetchBadges = React.useCallback(async () => {
    setBadgesState({ status: 'loading' })
    try {
      const response = await fetch('/api/user/badges')
      if (!response.ok) {
        setBadgesState({ status: 'error' })
        return
      }
      const data: BadgesResponse = await response.json()
      setBadgesState({ status: 'ready', data })
    } catch (error) {
      console.error('Error fetching badges:', error)
      setBadgesState({ status: 'error' })
    }
  }, [])

  React.useEffect(() => {
    fetchProgress()
    fetchBadges()
  }, [fetchProgress, fetchBadges])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Cargando tu progreso…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Mi Progreso</h1>
        <p className="text-gray-600 mt-1">Lo que vas construyendo, clase a clase</p>
      </div>

      {state.status === 'error' ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              No pudimos cargar tu progreso. Revisa tu conexión e intenta de nuevo.
            </p>
            <button
              onClick={fetchProgress}
              className="text-sm font-medium text-primary-600 underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      ) : state.data.totalClasses === 0 ? (
        <EmptyState />
      ) : (
        <ProgressContent
          data={state.data}
          badges={badgesState}
          onRetryBadges={fetchBadges}
          showCalories={showCalories}
          onShowCaloriesChange={setShowCalories}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 px-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <Sprout className="h-7 w-7 text-primary-600" />
        </div>
        <p className="font-serif text-xl font-semibold text-foreground">
          Todavía no tienes clases registradas
        </p>
        <p className="text-gray-600 mt-2 max-w-sm mx-auto">
          Cuando asistas a tu primera clase, aquí verás tu semana, tu racha y en qué invertiste tu
          práctica.
        </p>
        <Button asChild className="mt-6">
          <Link href="/reservar">Reservar una clase</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

interface ProgressContentProps {
  data: ProgressSummary
  badges: BadgesLoad
  onRetryBadges: () => void
  showCalories: boolean
  onShowCaloriesChange: (value: boolean) => void
}

function ProgressContent({ data, badges, onRetryBadges, showCalories, onShowCaloriesChange }: ProgressContentProps) {
  return (
    <>
      {/* 1. Tu última clase */}
      {data.lastClass && <LastClassCard lastClass={data.lastClass} showCalories={showCalories} />}

      {/* 2–3. Semana y racha */}
      <div className="grid gap-6 md:grid-cols-2">
        <WeekCard week={data.week} />
        <StreakCard streak={data.streak} />
      </div>

      {/* 4–5. Mezcla y flexibilidad/calma */}
      <div className="grid gap-6 md:grid-cols-2">
        <MixCard mix={data.mix30d} />
        <FlexCalmCard month={data.month} />
      </div>

      {/* 6. Logros */}
      <LogrosCard state={badges} onRetry={onRetryBadges} />

      {/* 7. Mes a mes */}
      <Card>
        <CardHeader>
          <SectionTitle icon={CalendarDays}>Mes a mes</SectionTitle>
          <CardDescription>Clases y minutos de los últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthBars months={data.months} />
        </CardContent>
      </Card>

      {/* 8. Preferencias: calorías y resumen por correo */}
      <CaloriesToggle checked={showCalories} onChange={onShowCaloriesChange} />
      <ProgressEmailToggle />

      {/* 9. Pie */}
      <p className="text-xs text-gray-500 text-center px-4 pb-4">{FOOTER_TEXT}</p>
    </>
  )
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <CardTitle className="text-xl flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary-600" />
      {children}
    </CardTitle>
  )
}

function LastClassCard({ lastClass, showCalories }: { lastClass: ClassSummary; showCalories: boolean }) {
  const type = lastClass.classType && lastClass.classType !== 'regular' ? formatClassType(lastClass.classType) : ''
  const kcal = lastClass.kcal

  return (
    <Card className="bg-gradient-to-br from-white to-primary-50">
      <CardHeader className="pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-primary-600">Tu última clase</p>
        <CardTitle className="text-2xl">
          {lastClass.disciplineName}
          {type && <span className="font-normal text-gray-600"> · {type}</span>}
        </CardTitle>
        <CardDescription>
          {formatDate(lastClass.date)} · {formatTime(lastClass.date)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary-600" />
            {lastClass.minutes} min
          </span>
          <span className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4 text-primary-600" />
            Intensidad: {lastClass.intensity}
          </span>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Foco trabajado">
          {lastClass.focus.map((f) => (
            <li key={f}>
              <Badge className="bg-white border border-beige-dark text-foreground">{f}</Badge>
            </li>
          ))}
        </ul>

        {showCalories && (
          <p className="flex items-center gap-1.5 text-sm text-gray-600">
            {kcal ? (
              <>
                <Activity className="h-4 w-4 text-accent" />
                <span>
                  <span className="font-semibold text-foreground">
                    ≈ {kcal.min}–{kcal.max} kcal
                  </span>{' '}
                  activas estimadas
                </span>
              </>
            ) : (
              <>
                <Wind className="h-4 w-4 text-accent" />
                {SOUND_THERAPY_TEXT}
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function WeekCard({ week }: { week: ProgressSummary['week'] }) {
  const reached = week.activeMinutes >= week.targetMinutes
  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Sparkles}>Tu semana</SectionTitle>
        <CardDescription>Minutos activos de lunes a domingo</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <ProgressRing value={week.activeMinutes} target={week.targetMinutes} />
        <div className="space-y-2 text-sm">
          <p className="text-foreground">
            <span className="font-semibold">{plural(week.classes, 'clase', 'clases')}</span> esta semana
          </p>
          {week.calmMinutes > 0 && (
            <p className="text-gray-600">+ {week.calmMinutes} min de calma</p>
          )}
          <p className="text-gray-600">
            {reached
              ? '¡Llegaste a la referencia de la semana!'
              : `La OMS recomienda ${WEEKLY_TARGET_MINUTES} min de actividad a la semana.`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StreakCard({ streak }: { streak: ProgressSummary['streak'] }) {
  let message: string
  if (streak.currentWeekHasClass) {
    message = streak.weeks > 1 ? 'Esta semana ya sumaste. ¡Sigue así!' : 'Esta semana ya sumaste.'
  } else {
    message =
      streak.weeks > 0
        ? 'Esta semana todavía estás a tiempo'
        : 'Esta semana todavía estás a tiempo de empezar una racha'
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={CalendarCheck}>Racha semanal</SectionTitle>
        <CardDescription>Semanas seguidas con al menos una clase</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sin racha no mostramos un 0 gigante: solo la invitación. */}
        {streak.weeks > 0 ? (
          <>
            <p className="font-serif text-5xl font-semibold text-foreground">{streak.weeks}</p>
            <p className="text-sm text-gray-600 mt-1">
              {streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas'}
            </p>
            <p className="text-sm text-foreground mt-4">{message}</p>
          </>
        ) : (
          <p className="text-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  )
}

function MixCard({ mix }: { mix: ProgressSummary['mix30d'] }) {
  const top = mix ? topAxes(mix, 2).map((a) => AXIS_LABELS[a]) : []
  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Compass}>
          Tu mezcla <span className="text-sm font-normal text-gray-600">(últimos 30 días)</span>
        </SectionTitle>
        <CardDescription>En qué invertiste tu práctica</CardDescription>
      </CardHeader>
      <CardContent>
        {mix ? (
          <>
            <MixRadar mix={mix} />
            {top.length > 0 && (
              <p className="text-sm text-foreground text-center mt-2">
                Lo que más trabajaste: <span className="font-semibold">{top.join(' y ')}</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600 py-6 text-center">
            No tienes clases en los últimos 30 días. Tu próxima clase vuelve a dibujar tu mezcla.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function FlexCalmCard({ month }: { month: ProgressSummary['month'] }) {
  const { current, previous } = month
  const rows = [
    {
      key: 'flex',
      label: 'Flexibilidad',
      icon: Leaf,
      value: current.flexMinutes,
      delta: monthDeltaText(current.flexMinutes, previous.flexMinutes, previous.label),
      note: null,
    },
    {
      key: 'calm',
      label: 'Calma',
      icon: Wind,
      value: current.calmMinutes,
      delta: monthDeltaText(current.calmMinutes, previous.calmMinutes, previous.label),
      note: 'Suma la calma de todas tus clases: terapia de sonido, yoga y los momentos tranquilos de las demás.',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Leaf}>Flexibilidad y calma</SectionTitle>
        <CardDescription>Este mes ({monthFullName(current.label)})</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ key, label, icon: Icon, value, delta, note }) => (
          <div key={key} className="flex items-start gap-3 rounded-xl bg-beige p-4">
            <Icon className="h-5 w-5 text-primary-600 mt-1 shrink-0" />
            <div>
              <p className="text-sm text-gray-600">{label}</p>
              <p className="text-2xl font-semibold text-foreground">
                {value} <span className="text-base font-normal text-gray-600">min</span>
              </p>
              {delta && <p className="text-sm text-primary-700 mt-0.5">{delta}</p>}
              {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-500">
          Es la práctica que acumulaste en tus clases según su tipo, no una medición de tu cuerpo.
        </p>
      </CardContent>
    </Card>
  )
}

function LogrosCard({ state, onRetry }: { state: BadgesLoad; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Trophy}>Logros</SectionTitle>
        <CardDescription>
          {state.status === 'ready'
            ? plural(state.data.earnedCount, 'logro ganado', 'logros ganados')
            : 'Insignias que ganas clase a clase'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.status === 'loading' ? (
          <div className="flex justify-center py-6" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Cargando tus logros…</span>
          </div>
        ) : state.status === 'error' ? (
          <p className="text-sm text-gray-600">
            No pudimos cargar tus logros.{' '}
            <button
              onClick={onRetry}
              className="font-medium text-primary-600 underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </p>
        ) : (
          <LogrosCardBody data={state.data} />
        )}

        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/perfil/logros">Ver todos mis logros</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function LogrosCardBody({ data }: { data: BadgesResponse }) {
  const challengeId = React.useId()
  const { challenge } = data
  const recent = recentBadges(data.badges, 3)
  const upcoming = nextBadges(data.badges, 2)
  const challengeEarned = challenge.earnedAt !== null
  const ratio = progressRatio(challenge)

  return (
    <>
      <div className="flex items-center gap-4 rounded-2xl bg-beige p-4">
        <BadgeArt
          badge={challenge}
          size={72}
          progress={challengeEarned ? undefined : ratio}
          idSuffix={challengeId}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{challenge.title}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-beige-dark" aria-hidden="true">
            <div className="h-full rounded-full bg-primary-600" style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-gray-600">{challengeStatusText(challenge)}</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {recent.length > 0 && (
          <MiniBadgeList title="Últimos ganados" badges={recent} />
        )}
        {upcoming.length > 0 && <MiniBadgeList title="Los más cercanos" badges={upcoming} />}
      </div>
    </>
  )
}

function MiniBadgeList({ title, badges }: { title: string; badges: BadgeState[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="mt-2 space-y-2">
        {badges.map((b) => (
          <MiniBadgeRow key={b.id} badge={b} />
        ))}
      </ul>
    </div>
  )
}

function MiniBadgeRow({ badge }: { badge: BadgeState }) {
  const idSuffix = React.useId()
  const earned = badge.earnedAt !== null
  return (
    <li className="flex items-center gap-3">
      <BadgeArt badge={badge} size={48} progress={earned ? undefined : progressRatio(badge)} idSuffix={idSuffix} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{badge.title}</p>
        <p className="text-xs text-gray-600">
          {earned && badge.earnedAt ? `Ganado el ${formatBadgeDate(badge.earnedAt)}` : badgeProgressText(badge)}
        </p>
      </div>
    </li>
  )
}

function CaloriesToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <PreferenceToggle
      id="mostrar-calorias"
      label="Mostrar calorías estimadas"
      description="Aparecen en tu última clase. La preferencia se guarda solo en este dispositivo."
      checked={checked}
      onChange={onChange}
    />
  )
}

type EmailPrefState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; enabled: boolean; saving: boolean; saveError: boolean }

const EMAIL_PREF_URL = '/api/user/progress-email'

/** Resumen por correo después de cada clase (encendido salvo baja). Cambio optimista con reversión. */
function ProgressEmailToggle() {
  const [pref, setPref] = React.useState<EmailPrefState>({ status: 'loading' })

  React.useEffect(() => {
    let active = true
    fetch(EMAIL_PREF_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as { enabled: boolean }
        if (active) setPref({ status: 'ready', enabled: data.enabled === true, saving: false, saveError: false })
      })
      .catch((error: unknown) => {
        console.error('Error fetching progress email preference:', error)
        if (active) setPref({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [])

  const handleChange = async (next: boolean) => {
    if (pref.status !== 'ready' || pref.saving) return
    const previous = pref.enabled
    setPref({ status: 'ready', enabled: next, saving: true, saveError: false })
    try {
      const response = await fetch(EMAIL_PREF_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setPref({ status: 'ready', enabled: next, saving: false, saveError: false })
    } catch (error) {
      console.error('Error updating progress email preference:', error)
      setPref({ status: 'ready', enabled: previous, saving: false, saveError: true })
    }
  }

  let description = 'Te llega cuando termina tu clase, con tu semana y tus logros.'
  if (pref.status === 'error') description = 'No pudimos cargar esta preferencia. Recarga la página para intentarlo de nuevo.'
  else if (pref.status === 'ready' && pref.saveError) description = 'No pudimos guardar el cambio. Intenta de nuevo.'

  return (
    <PreferenceToggle
      id="resumen-correo"
      label="Recibir un resumen por correo después de cada clase"
      description={description}
      checked={pref.status === 'ready' ? pref.enabled : true}
      disabled={pref.status !== 'ready'}
      busy={pref.status === 'loading' || (pref.status === 'ready' && pref.saving)}
      onChange={handleChange}
    />
  )
}

interface PreferenceToggleProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  busy?: boolean
}

function PreferenceToggle({ id, label, description, checked, onChange, disabled = false, busy = false }: PreferenceToggleProps) {
  const labelId = `${id}-label`
  const descId = `${id}-desc`
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div>
          <p id={labelId} className="font-medium text-foreground">
            {label}
          </p>
          <p id={descId} className="text-sm text-gray-600 mt-0.5" aria-live="polite">
            {description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={descId}
          aria-busy={busy || undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none',
            // Área táctil de 48×48 px sin cambiar el aspecto del interruptor.
            "after:absolute after:left-1/2 after:top-1/2 after:h-12 after:w-12 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            checked ? 'bg-primary-600' : 'bg-gray-300'
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none',
              checked ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </CardContent>
    </Card>
  )
}
