'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ChevronLeft, ChevronRight, Clock, User, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn, getWeekDays, getMonthName } from '@/lib/utils'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'

interface Discipline {
  id: string
  name: string
  slug: string
}

interface Instructor {
  id: string
  name: string
}

interface ClassData {
  id: string
  dateTime: string
  duration: number
  maxCapacity: number
  currentCount: number
  discipline: Discipline
  instructor: Instructor
  _count?: {
    reservations: number
  }
}

const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#D4A574]',
  soundbath: 'bg-[#8B7355]',
  nutricion: 'bg-[#6B7F5E]',
}

export default function HorariosPage() {
  const { data: session } = useSession()
  const [selectedDiscipline, setSelectedDiscipline] = React.useState('all')
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [classes, setClasses] = React.useState<ClassData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  })

  const weekDays = getWeekDays()

  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(currentWeekStart, i))
    }
    return dates
  }

  const weekDates = getWeekDates()

  // Memoize weekEnd to prevent infinite loop in useEffect
  // (endOfWeek creates a new Date object on every render)
  const weekEnd = React.useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
    [currentWeekStart]
  )

  // Fetch disciplines on mount
  React.useEffect(() => {
    const fetchDisciplines = async () => {
      try {
        const response = await fetch('/api/disciplines')
        if (response.ok) {
          const data = await response.json()
          setDisciplines(data)
        }
      } catch (error) {
        console.error('Error fetching disciplines:', error)
      }
    }
    fetchDisciplines()
  }, [])

  // Fetch classes for current week
  React.useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true)
      try {
        const startDate = format(currentWeekStart, 'yyyy-MM-dd')
        const endDate = format(weekEnd, 'yyyy-MM-dd')

        let url = `/api/classes?startDate=${startDate}&endDate=${endDate}`
        if (selectedDiscipline !== 'all') {
          const discipline = disciplines.find(d => d.slug === selectedDiscipline)
          if (discipline) {
            url += `&disciplineId=${discipline.id}`
          }
        }

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setClasses(data)
        }
      } catch (error) {
        console.error('Error fetching classes:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchClasses()
  }, [currentWeekStart, selectedDiscipline, disciplines, weekEnd])

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const getClassesForDay = (date: Date) => {
    return classes
      .filter((cls) => {
        const classDate = new Date(cls.dateTime)
        return (
          classDate.getDate() === date.getDate() &&
          classDate.getMonth() === date.getMonth() &&
          classDate.getFullYear() === date.getFullYear()
        )
      })
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const formatClassTime = (dateTime: string) => {
    const date = new Date(dateTime)
    return format(date, 'HH:mm')
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
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {disciplines.map((discipline) => (
                  <SelectItem key={discipline.id} value={discipline.slug}>
                    {discipline.name}
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
              {isLoading ? (
                <div className="col-span-7 flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                weekDates.map((date, dayIndex) => {
                  const dayClasses = getClassesForDay(date)
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        'border-r last:border-r-0 border-beige p-2 space-y-2',
                        isToday(date) && 'bg-primary/5'
                      )}
                    >
                      {dayClasses.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          Sin clases
                        </p>
                      ) : (
                        dayClasses.map((cls) => {
                          const reservationCount = cls._count?.reservations ?? cls.currentCount
                          const isFull = reservationCount >= cls.maxCapacity
                          const spotsLeft = cls.maxCapacity - reservationCount

                          return (
                            <div
                              key={cls.id}
                              className={cn(
                                'p-2 rounded-lg text-white text-xs cursor-pointer hover:opacity-90 transition-opacity',
                                disciplineColors[cls.discipline.slug] || 'bg-primary',
                                isFull && 'opacity-60'
                              )}
                            >
                              <p className="font-medium">{cls.discipline.name}</p>
                              <p className="flex items-center gap-1 opacity-90">
                                <Clock className="h-3 w-3" />
                                {formatClassTime(cls.dateTime)}
                              </p>
                              <p className="flex items-center gap-1 opacity-90">
                                <User className="h-3 w-3" />
                                {cls.instructor.name.split(' ')[0]}
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
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-6 justify-center">
            {disciplines.map((discipline) => (
              <div key={discipline.id} className="flex items-center gap-2">
                <div className={cn('w-4 h-4 rounded', disciplineColors[discipline.slug] || 'bg-primary')} />
                <span className="text-sm text-gray-600">
                  {discipline.name}
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
