'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, User, Users, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { cn, getWeekDays, getMonthName, formatClassType } from '@/lib/utils'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  disciplineColors,
  disciplineBorderColors,
  disciplineBadgeColors,
} from '@/config/disciplineColors'

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
  classType: string | null
  discipline: Discipline
  complementaryDiscipline?: Discipline | null
  instructor: Instructor
  _count?: {
    reservations: number
  }
}

// Colores importados desde @/config/disciplineColors (fuente única de verdad)

interface ActivePurchase {
  hasActivePackage: boolean
  classesRemaining: number
}

// Mobile Class Card Component
function MobileClassCard({
  cls,
  onClick,
}: {
  cls: ClassData
  onClick: () => void
}) {
  const reservationCount = cls._count?.reservations ?? cls.currentCount
  const isFull = reservationCount >= cls.maxCapacity
  const spotsLeft = cls.maxCapacity - reservationCount

  return (
    <button
      onClick={onClick}
      disabled={isFull}
      className={cn(
        'w-full p-4 bg-white rounded-xl border-l-4 shadow-sm',
        'text-left transition-all min-h-[88px]',
        disciplineBorderColors[cls.discipline.slug] || 'border-l-primary',
        isFull
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-md active:scale-[0.98] cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        {/* Left: Main info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Discipline badge */}
          <div className="flex flex-wrap gap-1">
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded text-xs font-medium',
                disciplineBadgeColors[cls.discipline.slug] || 'bg-primary text-white'
              )}
            >
              {cls.discipline.name}
            </span>
            {cls.complementaryDiscipline && (
              <>
                <span className="text-xs text-gray-400">+</span>
                <span
                  className={cn(
                    'inline-block px-2 py-0.5 rounded text-xs font-medium',
                    disciplineBadgeColors[cls.complementaryDiscipline.slug] || 'bg-primary text-white'
                  )}
                >
                  {cls.complementaryDiscipline.name}
                </span>
              </>
            )}
          </div>

          {/* Class type subtitle */}
          {cls.classType && (
            <p className="text-xs text-gray-500 italic">
              {formatClassType(cls.classType)}
            </p>
          )}

          {/* Time - prominent */}
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 flex-shrink-0 text-gray-500" />
            <span className="text-lg font-semibold">
              {format(new Date(cls.dateTime), 'HH:mm')}
            </span>
            <span className="text-sm text-gray-500">
              ({cls.duration} min)
            </span>
          </div>

          {/* Instructor */}
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm truncate">{cls.instructor.name}</span>
          </div>
        </div>

        {/* Right: Spots status */}
        <div className={cn(
          'flex-shrink-0 flex flex-col items-center justify-center',
          'px-3 py-2 rounded-lg min-w-[70px]',
          isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
        )}>
          <Users className="h-4 w-4 mb-1" />
          <span className="text-xs font-medium text-center">
            {isFull ? 'Lleno' : `${spotsLeft} cupos`}
          </span>
        </div>
      </div>
    </button>
  )
}

// Mobile Day Accordion Component
function MobileDayAccordion({
  date,
  classes,
  isToday,
  weekDays,
  onClassClick,
}: {
  date: Date
  classes: ClassData[]
  isToday: boolean
  weekDays: string[]
  onClassClick: (cls: ClassData) => void
}) {
  const [isOpen, setIsOpen] = React.useState(isToday || classes.length > 0)

  const dayName = weekDays[date.getDay()]
  const dayNumber = date.getDate()
  const monthName = format(date, 'MMM', { locale: es })

  return (
    <div className={cn(
      'rounded-xl overflow-hidden',
      isToday ? 'ring-2 ring-primary ring-offset-2' : 'border border-gray-200'
    )}>
      {/* Day Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4',
          'min-h-[56px] transition-colors',
          isToday ? 'bg-primary/10' : 'bg-gray-50 hover:bg-gray-100'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex flex-col items-center justify-center',
            'w-12 h-12 rounded-lg',
            isToday ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-foreground'
          )}>
            <span className="text-xs uppercase font-medium leading-none">
              {dayName.slice(0, 3)}
            </span>
            <span className="text-lg font-bold leading-none mt-0.5">
              {dayNumber}
            </span>
          </div>
          <div className="text-left">
            <span className="text-sm text-gray-500 capitalize">{monthName}</span>
            {isToday && (
              <span className="ml-2 text-xs font-medium text-primary">Hoy</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-medium px-2 py-1 rounded-full',
            classes.length > 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
          )}>
            {classes.length} {classes.length === 1 ? 'clase' : 'clases'}
          </span>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Classes List */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#F5F3EF]">
          {classes.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">
              No hay clases programadas
            </p>
          ) : (
            classes.map((cls) => (
              <MobileClassCard
                key={cls.id}
                cls={cls}
                onClick={() => onClassClick(cls)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function HorariosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedDiscipline, setSelectedDiscipline] = React.useState('all')
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [classes, setClasses] = React.useState<ClassData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  })

  // For booking flow
  const [activePurchase, setActivePurchase] = React.useState<ActivePurchase | null>(null)
  const [showLoginModal, setShowLoginModal] = React.useState(false)
  const [showNoPackageModal, setShowNoPackageModal] = React.useState(false)

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

  // Fetch active purchase for logged-in users
  React.useEffect(() => {
    const fetchActivePurchase = async () => {
      if (!session) return
      try {
        const response = await fetch('/api/user/active-purchase')
        if (response.ok) {
          const data = await response.json()
          setActivePurchase(data)
        }
      } catch (error) {
        console.error('Error fetching active purchase:', error)
      }
    }
    fetchActivePurchase()
  }, [session])

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

  const handleClassClick = (cls: ClassData) => {
    const reservationCount = cls._count?.reservations ?? cls.currentCount
    const isFull = reservationCount >= cls.maxCapacity

    if (isFull) return

    // Not logged in - show login modal
    if (!session) {
      setShowLoginModal(true)
      return
    }

    // Logged in but no active package - show package modal
    if (!activePurchase?.hasActivePackage || activePurchase.classesRemaining <= 0) {
      setShowNoPackageModal(true)
      return
    }

    // Logged in with active package - redirect to reservar with class preselected
    router.push(`/reservar?classId=${cls.id}`)
  }

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-8 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground mb-4 sm:mb-6">
            Horarios
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Encuentra la clase perfecta para tu día. Filtra por disciplina y
            reserva tu espacio.
          </p>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-6 sm:py-8 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Controls - Stack on mobile, row on desktop */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            {/* Week navigation - centered on mobile */}
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <button
                onClick={goToPreviousWeek}
                className="p-3 sm:p-2 rounded-full hover:bg-beige transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-medium text-foreground min-w-[180px] sm:min-w-[200px] text-center text-sm sm:text-base">
                {getMonthName(currentWeekStart.getMonth())}{' '}
                {currentWeekStart.getFullYear()}
              </span>
              <button
                onClick={goToNextWeek}
                className="p-3 sm:p-2 rounded-full hover:bg-beige transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Filter - full width on mobile */}
            <Select
              value={selectedDiscipline}
              onValueChange={setSelectedDiscipline}
            >
              <SelectTrigger className="w-full sm:w-[260px] sm:mx-auto min-h-[44px]">
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

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Mobile Agenda View - Only visible on < md */}
              <div className="md:hidden space-y-4">
                {weekDates.map((date, index) => (
                  <MobileDayAccordion
                    key={index}
                    date={date}
                    classes={getClassesForDay(date)}
                    isToday={isToday(date)}
                    weekDays={weekDays}
                    onClassClick={handleClassClick}
                  />
                ))}
              </div>

              {/* Desktop Calendar Grid - Only visible on >= md */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
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
                              <button
                                key={cls.id}
                                onClick={() => handleClassClick(cls)}
                                disabled={isFull}
                                className={cn(
                                  'w-full p-2 rounded-lg text-white text-xs text-left transition-all',
                                  disciplineColors[cls.discipline.slug] || 'bg-primary',
                                  isFull
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:scale-[1.02] hover:shadow-md cursor-pointer'
                                )}
                              >
                                <p className="font-medium truncate">
                                  {cls.discipline.name}
                                  {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline.name}`}
                                </p>
                                {cls.classType && (
                                  <>
                                    <div className="border-t border-white/30 my-1" />
                                    <p className="opacity-80 italic truncate">{formatClassType(cls.classType)}</p>
                                  </>
                                )}
                                <p className="flex items-center gap-1 opacity-90">
                                  <Clock className="h-3 w-3 flex-shrink-0" />
                                  {formatClassTime(cls.dateTime)}
                                </p>
                                <p className="flex items-center gap-1 opacity-90 min-w-0">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{cls.instructor.name.split(' ')[0]}</span>
                                </p>
                                <p className="flex items-center gap-1 mt-1">
                                  <Users className="h-3 w-3 flex-shrink-0" />
                                  {isFull ? 'Lleno' : `${spotsLeft} cupos`}
                                </p>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-6 justify-center">
            {disciplines.map((discipline) => (
              <div key={discipline.id} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 sm:w-4 sm:h-4 rounded', disciplineColors[discipline.slug] || 'bg-primary')} />
                <span className="text-xs sm:text-sm text-gray-600">
                  {discipline.name}
                </span>
              </div>
            ))}
          </div>

          {/* CTA for non-logged users */}
          {!session && (
            <div className="mt-8 sm:mt-12 p-6 sm:p-8 bg-white rounded-2xl text-center border border-beige">
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-foreground mb-3">
                ¿Quieres reservar una clase?
              </h3>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">
                Crea una cuenta gratuita para reservar tu espacio y administrar
                tus clases.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link href="/registro">
                  <Button className="w-full sm:w-auto min-h-[44px]">Crear Cuenta</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">Ya tengo cuenta</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Login Required Modal */}
      <Modal open={showLoginModal} onOpenChange={setShowLoginModal}>
        <ModalContent className="max-w-md mx-4">
          <ModalHeader>
            <ModalTitle>Inicia sesión para reservar</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Para reservar una clase, necesitas iniciar sesión o crear una cuenta gratuita.
            </p>
          </div>
          <ModalFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowLoginModal(false)} className="w-full sm:w-auto min-h-[44px]">
              Cancelar
            </Button>
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full min-h-[44px]">Iniciar Sesión</Button>
            </Link>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* No Package Modal */}
      <Modal open={showNoPackageModal} onOpenChange={setShowNoPackageModal}>
        <ModalContent className="max-w-md mx-4">
          <ModalHeader>
            <ModalTitle>Necesitas un paquete activo</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <p className="text-gray-600">
              {activePurchase?.classesRemaining === 0
                ? 'Ya no te quedan clases en tu paquete actual. Adquiere un nuevo paquete para seguir reservando.'
                : 'Para reservar clases, necesitas adquirir un paquete. Explora nuestras opciones y encuentra el paquete perfecto para ti.'}
            </p>
          </div>
          <ModalFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNoPackageModal(false)} className="w-full sm:w-auto min-h-[44px]">
              Cancelar
            </Button>
            <Link href="/paquetes" className="w-full sm:w-auto">
              <Button className="w-full min-h-[44px]">Ver Paquetes</Button>
            </Link>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
