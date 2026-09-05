'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DAY_NAMES_SHORT,
  MAX_DATES_PER_BATCH,
  MONTH_NAMES_LONG,
  addDaysToDateStr,
  expandWeekdayPattern,
  formatDateShort,
  getTodaySV,
  toDateStr,
} from '@/lib/schedule/classDates'

interface ClassDatePickerProps {
  /** Fechas finales seleccionadas (YYYY-MM-DD, ordenadas). */
  value: string[]
  onChange: (dates: string[]) => void
  /** Fecha en la que abre el calendario y que arranca preseleccionada. */
  initialDate?: string
}

/** Iniciales de los días, empezando en domingo para calzar con getDay(). */
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export default function ClassDatePicker({ value, onChange, initialDate }: ClassDatePickerProps) {
  const today = React.useMemo(() => getTodaySV(), [])
  const startDate = initialDate && initialDate >= today ? initialDate : today

  // El patrón semanal y los clicks sueltos conviven: el patrón genera fechas y
  // los clicks las agregan o las quitan una por una.
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [patternFrom, setPatternFrom] = React.useState(startDate)
  const [patternUntil, setPatternUntil] = React.useState(() => addDaysToDateStr(startDate, 56))
  const [manualAdds, setManualAdds] = React.useState<Set<string>>(
    () => new Set(initialDate ? [startDate] : [])
  )
  const [manualRemoves, setManualRemoves] = React.useState<Set<string>>(() => new Set())

  const [viewYear, setViewYear] = React.useState(() => Number(startDate.slice(0, 4)))
  const [viewMonth, setViewMonth] = React.useState(() => Number(startDate.slice(5, 7)) - 1)

  const patternDates = React.useMemo(
    () => expandWeekdayPattern(weekdays, patternFrom, patternUntil),
    [weekdays, patternFrom, patternUntil]
  )

  // Fuente única de la selección final. El padre solo la recibe.
  const computed = React.useMemo(() => {
    const all = new Set<string>([...patternDates, ...Array.from(manualAdds)])
    manualRemoves.forEach((d) => all.delete(d))
    return Array.from(all)
      .filter((d) => d >= today)
      .sort()
  }, [patternDates, manualAdds, manualRemoves, today])

  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    onChangeRef.current(computed)
  }, [computed])

  const selectedSet = React.useMemo(() => new Set(value), [value])

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const toggleDate = (dateStr: string) => {
    if (dateStr < today) return

    if (selectedSet.has(dateStr)) {
      setManualAdds((prev) => {
        const next = new Set(prev)
        next.delete(dateStr)
        return next
      })
      setManualRemoves((prev) => new Set(prev).add(dateStr))
    } else {
      setManualRemoves((prev) => {
        const next = new Set(prev)
        next.delete(dateStr)
        return next
      })
      setManualAdds((prev) => new Set(prev).add(dateStr))
    }
  }

  const clearAll = () => {
    setWeekdays([])
    setManualAdds(new Set())
    setManualRemoves(new Set())
  }

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  // Celdas del mes, alineadas a una cuadrícula que empieza en domingo.
  const monthCells = React.useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: Array<string | null> = Array(firstDayOfWeek).fill(null)
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(toDateStr(viewYear, viewMonth, day))
    }
    return cells
  }, [viewYear, viewMonth])

  const atLimit = value.length >= MAX_DATES_PER_BATCH
  const canGoPrevMonth = toDateStr(viewYear, viewMonth, 1) > today

  return (
    <div className="space-y-4">
      {/* Patrón semanal */}
      <div className="rounded-lg border border-beige p-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Se repite los días</p>
          <div className="flex gap-1.5 mt-2">
            {WEEKDAY_INITIALS.map((initial, day) => {
              const isOn = weekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  aria-pressed={isOn}
                  aria-label={DAY_NAMES_SHORT[day]}
                  className={cn(
                    'h-9 w-9 rounded-full text-sm font-medium transition-colors',
                    isOn
                      ? 'bg-primary text-white'
                      : 'bg-beige/60 text-gray-600 hover:bg-beige'
                  )}
                >
                  {initial}
                </button>
              )
            })}
          </div>
        </div>

        {weekdays.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">Desde</span>
              <input
                type="date"
                value={patternFrom}
                min={today}
                max={patternUntil}
                onChange={(e) => e.target.value && setPatternFrom(e.target.value)}
                className="w-full px-2 py-1.5 border border-beige rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">Hasta</span>
              <input
                type="date"
                value={patternUntil}
                min={patternFrom}
                onChange={(e) => e.target.value && setPatternUntil(e.target.value)}
                className="w-full px-2 py-1.5 border border-beige rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>
          </div>
        )}
      </div>

      {/* Calendario mensual */}
      <div className="rounded-lg border border-beige p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            disabled={!canGoPrevMonth}
            aria-label="Mes anterior"
            className="p-1.5 rounded-full hover:bg-beige transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium capitalize">
            {MONTH_NAMES_LONG[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Mes siguiente"
            className="p-1.5 rounded-full hover:bg-beige transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_INITIALS.map((initial, i) => (
            <div key={i} className="text-center text-[11px] text-gray-400 font-medium">
              {initial}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {monthCells.map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} />

            const isPast = dateStr < today
            const isSelected = selectedSet.has(dateStr)
            const isToday = dateStr === today
            const isBlockedByLimit = atLimit && !isSelected

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggleDate(dateStr)}
                disabled={isPast || isBlockedByLimit}
                aria-pressed={isSelected}
                className={cn(
                  'h-9 rounded-lg text-sm transition-colors',
                  isSelected
                    ? 'bg-primary text-white font-medium'
                    : 'hover:bg-beige text-gray-700',
                  isPast && 'text-gray-300 cursor-not-allowed hover:bg-transparent',
                  isBlockedByLimit && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                  isToday && !isSelected && 'ring-1 ring-primary/40'
                )}
              >
                {Number(dateStr.slice(8, 10))}
              </button>
            )
          })}
        </div>
      </div>

      {/* Resumen de la selección */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            {value.length === 0
              ? 'Ninguna fecha seleccionada'
              : `${value.length} ${value.length === 1 ? 'fecha seleccionada' : 'fechas seleccionadas'}`}
          </p>
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar
            </button>
          )}
        </div>

        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {value.map((dateStr) => (
              <span
                key={dateStr}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-beige/70 text-xs text-gray-700"
              >
                {formatDateShort(dateStr)}
                <button
                  type="button"
                  onClick={() => toggleDate(dateStr)}
                  aria-label={`Quitar ${formatDateShort(dateStr)}`}
                  className="rounded-full p-0.5 hover:bg-beige-dark/40"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {atLimit && (
          <p className="text-xs text-amber-600 mt-2">
            Máximo {MAX_DATES_PER_BATCH} clases por vez. Quita alguna fecha para agregar otra.
          </p>
        )}
      </div>
    </div>
  )
}
