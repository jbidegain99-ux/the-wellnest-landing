'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Activity,
  Award,
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  Leaf,
  Loader2,
  Sparkles,
  Sprout,
  Wind,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProgressRing } from '@/components/progress/ProgressRing'
import { MixRadar } from '@/components/progress/MixRadar'
import { MonthBars } from '@/components/progress/MonthBars'
import { useShowCalories } from '@/components/progress/useShowCalories'
import { AXIS_LABELS } from '@/lib/progress/profiles'
import {
  EXPLORER_DISCIPLINES,
  MILESTONES,
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

export default function ProgresoPage() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })
  const [showCalories, setShowCalories] = useShowCalories()

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

  React.useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

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
  showCalories: boolean
  onShowCaloriesChange: (value: boolean) => void
}

function ProgressContent({ data, showCalories, onShowCaloriesChange }: ProgressContentProps) {
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

      {/* 6. Hitos */}
      <MilestonesCard total={data.totalClasses} milestones={data.milestones} />

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

      {/* 8. Preferencia de calorías */}
      <CaloriesToggle checked={showCalories} onChange={onShowCaloriesChange} />

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

function MilestonesCard({
  total,
  milestones,
}: {
  total: number
  milestones: ProgressSummary['milestones']
}) {
  const { next, remaining, explorer } = milestones
  const explorerLeft = Math.max(0, EXPLORER_DISCIPLINES - explorer.disciplines)

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Award}>Hitos</SectionTitle>
        <CardDescription>{plural(total, 'clase tomada', 'clases tomadas')} en Wellnest</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="flex flex-wrap gap-3">
          {MILESTONES.map((m) => {
            const reached = milestones.reached.includes(m)
            const isNext = m === next
            return (
              <li
                key={m}
                className={cn(
                  'flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-center',
                  reached
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : isNext
                      ? 'border-dashed border-primary-600 bg-white text-primary-700'
                      : 'border-beige-dark bg-white text-gray-400'
                )}
              >
                <span className="text-base font-semibold leading-none">{m}</span>
                <span className="text-[10px] leading-tight">{m === 1 ? 'clase' : 'clases'}</span>
                <span className="sr-only">{reached ? ' (alcanzado)' : isNext ? ' (próximo)' : ''}</span>
              </li>
            )
          })}
        </ul>

        <p className="text-sm text-foreground">
          {next !== null && remaining !== null
            ? `${remaining === 1 ? 'Te falta 1 clase' : `Te faltan ${remaining} clases`} para llegar a ${next}.`
            : '¡Llegaste a las 100 clases! Qué constancia tan bonita.'}
        </p>

        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-4',
            explorer.reached ? 'bg-primary-50' : 'bg-beige'
          )}
        >
          <Compass className={cn('h-6 w-6 shrink-0', explorer.reached ? 'text-primary-600' : 'text-gray-400')} />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Exploradora</p>
            <p className="text-gray-600">
              {explorer.reached
                ? `Probaste ${explorer.disciplines} disciplinas distintas.`
                : `Llevas ${plural(explorer.disciplines, 'disciplina', 'disciplinas')}; prueba ${explorerLeft} más para desbloquearlo.`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CaloriesToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const labelId = 'mostrar-calorias-label'
  const descId = 'mostrar-calorias-desc'
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div>
          <p id={labelId} className="font-medium text-foreground">
            Mostrar calorías estimadas
          </p>
          <p id={descId} className="text-sm text-gray-600 mt-0.5">
            Aparecen en tu última clase. La preferencia se guarda solo en este dispositivo.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={descId}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none',
            // Área táctil de 48×48 px sin cambiar el aspecto del interruptor.
            "after:absolute after:left-1/2 after:top-1/2 after:h-12 after:w-12 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
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
