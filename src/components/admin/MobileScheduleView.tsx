'use client'

import * as React from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { cn, formatClassType } from '@/lib/utils'
import { getNowInSV } from '@/lib/utils/timezone'

interface ClassItem {
  id: string
  disciplineId: string
  discipline: string
  complementaryDisciplineId?: string | null
  complementaryDiscipline?: string | null
  instructorId: string
  instructor: string
  dateTime: string
  time: string
  duration: number
  maxCapacity: number
  dayOfWeek: number
  isRecurring: boolean
  isCancelled?: boolean
  classType?: string | null
  reservationsCount?: number
}

interface MobileScheduleViewProps {
  weekDates: Date[]
  weekDays: string[]
  getClassesForDay: (date: Date) => ClassItem[]
  getDisciplineColorForClass: (disciplineName: string) => string
  onEditClass: (cls: ClassItem) => void
  onAddClass: (dayOfWeek: number) => void
  isDuplicateMode?: boolean
  selectedClassIds?: Set<string>
  onToggleClass?: (classId: string) => void
  onSelectAllForDay?: (dayOfWeek: number) => void
}

export default function MobileScheduleView({
  weekDates,
  weekDays,
  getClassesForDay,
  getDisciplineColorForClass,
  onEditClass,
  onAddClass,
  isDuplicateMode,
  selectedClassIds,
  onToggleClass,
  onSelectAllForDay,
}: MobileScheduleViewProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  const [expandedDays, setExpandedDays] = React.useState<Set<number>>(() => {
    const initial = new Set<number>()
    // Expand today's day by default
    weekDates.forEach((date, index) => {
      const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (dateStr === todayStr) {
        initial.add(index)
      }
    })
    // If today isn't in this week, expand the first day
    if (initial.size === 0 && weekDates.length > 0) {
      initial.add(0)
    }
    return initial
  })

  const toggleDay = (index: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="space-y-2">
      {weekDates.map((date, index) => {
        const dayClasses = getClassesForDay(date)
        const isExpanded = expandedDays.has(index)
        const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const isToday = dateStr === todayStr

        return (
          <div
            key={index}
            className={cn(
              'rounded-xl border overflow-hidden',
              isToday ? 'border-primary/40 bg-primary/5' : 'border-beige bg-white'
            )}
          >
            {/* Day header */}
            <button
              onClick={() => toggleDay(index)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                {isDuplicateMode && onSelectAllForDay && (
                  <input
                    type="checkbox"
                    checked={dayClasses.filter(c => !c.isCancelled).length > 0 && dayClasses.filter(c => !c.isCancelled).every(c => selectedClassIds?.has(c.id))}
                    onChange={(e) => {
                      e.stopPropagation()
                      onSelectAllForDay(date.getDay())
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-beige-dark accent-primary shrink-0"
                  />
                )}
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-serif text-lg font-semibold',
                  isToday ? 'bg-primary text-white' : 'bg-beige text-foreground'
                )}>
                  {date.getDate()}
                </div>
                <div>
                  <p className={cn(
                    'font-medium',
                    isToday ? 'text-primary' : 'text-foreground'
                  )}>
                    {weekDays[date.getDay()]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dayClasses.length} {dayClasses.length === 1 ? 'clase' : 'clases'}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-gray-400 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {dayClasses.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Sin clases programadas
                  </p>
                ) : (
                  dayClasses.map((cls) => {
                    const isPast = new Date(cls.dateTime) < getNowInSV()
                    const isEligible = isDuplicateMode && !cls.isCancelled
                    const isSelected = selectedClassIds?.has(cls.id)
                    return (
                      <div
                        key={cls.id}
                        onClick={() => {
                          if (isEligible && onToggleClass) {
                            onToggleClass(cls.id)
                          } else if (!isDuplicateMode) {
                            onEditClass(cls)
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg text-white cursor-pointer active:opacity-80 transition-all',
                          cls.isCancelled ? 'bg-gray-400' : getDisciplineColorForClass(cls.discipline),
                          isPast && 'opacity-50',
                          isSelected && 'ring-2 ring-primary ring-offset-1'
                        )}
                      >
                        {isEligible && (
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => onToggleClass?.(cls.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-white accent-primary shrink-0 mr-2"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {cls.discipline}
                            {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline}`}
                          </p>
                          {cls.classType && (
                            <p className="text-[10px] opacity-75 italic truncate">{formatClassType(cls.classType)}</p>
                          )}
                          <p className="text-xs opacity-80">
                            {cls.time} · {cls.instructor.split(' ')[0]}
                          </p>
                          {isPast && (
                            <p className="text-xs font-medium italic mt-0.5">Clase finalizada</p>
                          )}
                          {cls.isCancelled && (
                            <p className="text-[10px] font-medium uppercase mt-0.5">Cancelada</p>
                          )}
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          {isPast ? (
                            <p className="text-xs italic opacity-75">Finalizada</p>
                          ) : (
                            <>
                              <p className="text-sm font-medium">
                                {cls.reservationsCount || 0}/{cls.maxCapacity}
                              </p>
                              <p className="text-[10px] opacity-75">cupos</p>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}

                <button
                  onClick={() => onAddClass(date.getDay())}
                  className="w-full border-2 border-dashed border-stone-300 rounded-lg py-2.5 text-stone-400 text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Agregar clase
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
