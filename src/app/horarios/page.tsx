'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ChevronLeft, ChevronRight, Clock, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn, formatTime, getWeekDays, getMonthName } from '@/lib/utils'

// Sample schedule data
const sampleClasses = [
  {
    id: '1',
    discipline: 'Yoga',
    disciplineSlug: 'yoga',
    instructor: 'María García',
    time: '06:00',
    duration: 60,
    maxCapacity: 15,
    currentCount: 12,
    dayOfWeek: 1,
  },
  {
    id: '2',
    discipline: 'Pilates Mat',
    disciplineSlug: 'pilates',
    instructor: 'Ana Martínez',
    time: '08:00',
    duration: 55,
    maxCapacity: 12,
    currentCount: 12,
    dayOfWeek: 1,
  },
  {
    id: '3',
    discipline: 'Yoga',
    disciplineSlug: 'yoga',
    instructor: 'Laura Vega',
    time: '10:00',
    duration: 75,
    maxCapacity: 15,
    currentCount: 8,
    dayOfWeek: 1,
  },
  {
    id: '4',
    discipline: 'Pole Sport',
    disciplineSlug: 'pole',
    instructor: 'Carolina López',
    time: '18:00',
    duration: 60,
    maxCapacity: 8,
    currentCount: 5,
    dayOfWeek: 1,
  },
  {
    id: '5',
    discipline: 'Sound Healing',
    disciplineSlug: 'soundhealing',
    instructor: 'Sofía Hernández',
    time: '19:30',
    duration: 90,
    maxCapacity: 20,
    currentCount: 15,
    dayOfWeek: 3,
  },
  {
    id: '6',
    discipline: 'Yoga',
    disciplineSlug: 'yoga',
    instructor: 'María García',
    time: '07:00',
    duration: 60,
    maxCapacity: 15,
    currentCount: 10,
    dayOfWeek: 2,
  },
  {
    id: '7',
    discipline: 'Pilates Mat',
    disciplineSlug: 'pilates',
    instructor: 'Laura Vega',
    time: '09:00',
    duration: 55,
    maxCapacity: 12,
    currentCount: 9,
    dayOfWeek: 2,
  },
  {
    id: '8',
    discipline: 'Pole Sport',
    disciplineSlug: 'pole',
    instructor: 'Carolina López',
    time: '17:00',
    duration: 60,
    maxCapacity: 8,
    currentCount: 6,
    dayOfWeek: 4,
  },
  {
    id: '9',
    discipline: 'Yoga',
    disciplineSlug: 'yoga',
    instructor: 'María García',
    time: '08:00',
    duration: 60,
    maxCapacity: 15,
    currentCount: 14,
    dayOfWeek: 6,
  },
  {
    id: '10',
    discipline: 'Sound Healing',
    disciplineSlug: 'soundhealing',
    instructor: 'Sofía Hernández',
    time: '10:00',
    duration: 90,
    maxCapacity: 20,
    currentCount: 18,
    dayOfWeek: 6,
  },
]

const disciplines = [
  { value: 'all', label: 'Todas las disciplinas' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates Mat' },
  { value: 'pole', label: 'Pole Sport' },
  { value: 'soundhealing', label: 'Sound Healing' },
]

const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#D4A574]',
  soundhealing: 'bg-[#8B7355]',
}

export default function HorariosPage() {
  const { data: session } = useSession()
  const [selectedDiscipline, setSelectedDiscipline] = React.useState('all')
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(today.setDate(diff))
  })

  const weekDays = getWeekDays()

  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() - 7)
    setCurrentWeekStart(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + 7)
    setCurrentWeekStart(newDate)
  }

  const getClassesForDay = (dayIndex: number) => {
    return sampleClasses
      .filter((cls) => {
        const matchesDay = cls.dayOfWeek === dayIndex
        const matchesDiscipline =
          selectedDiscipline === 'all' ||
          cls.disciplineSlug === selectedDiscipline
        return matchesDay && matchesDiscipline
      })
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Horarios
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Encuentra la clase perfecta para tu día. Filtra por disciplina y
            reserva tu espacio.
          </p>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-8 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            {/* Week navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousWeek}
                className="p-2 rounded-full hover:bg-beige transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-medium text-foreground min-w-[200px] text-center">
                {getMonthName(currentWeekStart.getMonth())}{' '}
                {currentWeekStart.getFullYear()}
              </span>
              <button
                onClick={goToNextWeek}
                className="p-2 rounded-full hover:bg-beige transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Filter */}
            <Select
              value={selectedDiscipline}
              onValueChange={setSelectedDiscipline}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por disciplina" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((discipline) => (
                  <SelectItem key={discipline.value} value={discipline.value}>
                    {discipline.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Days header */}
            <div className="grid grid-cols-7 border-b border-beige">
              {weekDates.map((date, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-4 text-center border-r last:border-r-0 border-beige',
                    isToday(date) && 'bg-primary/5'
                  )}
                >
                  <p className="text-sm text-gray-500">{weekDays[date.getDay()]}</p>
                  <p
                    className={cn(
                      'font-serif text-2xl font-semibold',
                      isToday(date) ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {date.getDate()}
                  </p>
                </div>
              ))}
            </div>

            {/* Classes grid */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {weekDates.map((date, dayIndex) => {
                const classes = getClassesForDay(date.getDay())
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'border-r last:border-r-0 border-beige p-2 space-y-2',
                      isToday(date) && 'bg-primary/5'
                    )}
                  >
                    {classes.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        Sin clases
                      </p>
                    ) : (
                      classes.map((cls) => {
                        const isFull = cls.currentCount >= cls.maxCapacity
                        const spotsLeft = cls.maxCapacity - cls.currentCount

                        return (
                          <div
                            key={cls.id}
                            className={cn(
                              'p-2 rounded-lg text-white text-xs',
                              disciplineColors[cls.disciplineSlug],
                              isFull && 'opacity-60'
                            )}
                          >
                            <p className="font-medium">{cls.discipline}</p>
                            <p className="flex items-center gap-1 opacity-90">
                              <Clock className="h-3 w-3" />
                              {cls.time}
                            </p>
                            <p className="flex items-center gap-1 opacity-90">
                              <User className="h-3 w-3" />
                              {cls.instructor.split(' ')[0]}
                            </p>
                            <p className="flex items-center gap-1 mt-1">
                              <Users className="h-3 w-3" />
                              {isFull ? 'Lleno' : `${spotsLeft} cupos`}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-6 justify-center">
            {Object.entries(disciplineColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('w-4 h-4 rounded', color)} />
                <span className="text-sm text-gray-600 capitalize">
                  {key === 'soundhealing' ? 'Sound Healing' : key}
                </span>
              </div>
            ))}
          </div>

          {/* CTA for non-logged users */}
          {!session && (
            <div className="mt-12 p-8 bg-white rounded-2xl text-center border border-beige">
              <h3 className="font-serif text-2xl font-semibold text-foreground mb-3">
                ¿Quieres reservar una clase?
              </h3>
              <p className="text-gray-600 mb-6">
                Crea una cuenta gratuita para reservar tu espacio y administrar
                tus clases.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/registro">
                  <Button>Crear Cuenta</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline">Ya tengo cuenta</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
