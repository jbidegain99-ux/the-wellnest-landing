'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, User, Users, UserPlus, Check, Loader2, AlertCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn, getWeekDays, getMonthName, formatClassType } from '@/lib/utils'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

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

interface ActivePurchase {
  hasActivePackage: boolean
  classesRemaining: number
  expiresAt?: string
  purchaseId?: string
  packageId?: string
  package?: {
    id: string
    name: string
    isShareable: boolean
    maxShares: number
  }
}

const TRIAL_PACKAGE_ID = 'cmm78xhwt0000bfage9rlmp2m'
// March 9, 2026 midnight in El Salvador (UTC-6) = 06:00 UTC
const TRIAL_CUTOFF_UTC = new Date('2026-03-09T06:00:00Z')

interface SelectedPurchase {
  id: string
  packageName: string
  classesRemaining: number
  expiresAt: string
}

// Modal states - separate state for each modal type to prevent conflicts
type ModalState = 'closed' | 'confirm' | 'success' | 'error'

// El Salvador is UTC-6 (no DST)
function getNowSV(): Date {
  return new Date(Date.now() - 6 * 60 * 60 * 1000)
}

const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#E5E5E5]',
  soundbath: 'bg-[#F5E9DD]',
  'terapia-de-sonido': 'bg-[#F5E9DD]',
  nutricion: 'bg-[#6B7F5E]',
}

// Mobile day accordion for responsive reservar view
function MobileDaySection({
  date,
  classes,
  isToday: today,
  weekDays,
  reservedClassIds,
  activePurchase,
  onClassClick,
}: {
  date: Date
  classes: ClassData[]
  isToday: boolean
  weekDays: string[]
  reservedClassIds: Set<string>
  activePurchase: ActivePurchase | null
  onClassClick: (cls: ClassData) => void
}) {
  const [isOpen, setIsOpen] = React.useState(today || classes.length > 0)

  const dayName = weekDays[date.getDay()]
  const dayNumber = date.getDate()
  const monthName = format(date, 'MMM', { locale: es })

  return (
    <div className={cn(
      'rounded-xl overflow-hidden',
      today ? 'ring-2 ring-primary ring-offset-2' : 'border border-gray-200'
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4 min-h-[56px] transition-colors',
          today ? 'bg-primary/10' : 'bg-gray-50 hover:bg-gray-100'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex flex-col items-center justify-center w-12 h-12 rounded-lg',
            today ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-foreground'
          )}>
            <span className="text-xs uppercase font-medium leading-none">{dayName.slice(0, 3)}</span>
            <span className="text-lg font-bold leading-none mt-0.5">{dayNumber}</span>
          </div>
          <div className="text-left">
            <span className="text-sm text-gray-500 capitalize">{monthName}</span>
            {today && <span className="ml-2 text-xs font-medium text-primary">Hoy</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-medium px-2 py-1 rounded-full',
            classes.length > 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
          )}>
            {classes.length} {classes.length === 1 ? 'clase' : 'clases'}
          </span>
          {isOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#F5F3EF]">
          {classes.length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No hay clases programadas</p>
          ) : (
            classes.map((cls) => {
              const reservationCount = cls._count?.reservations ?? cls.currentCount
              const isFull = reservationCount >= cls.maxCapacity
              const spotsLeft = cls.maxCapacity - reservationCount
              const alreadyReserved = reservedClassIds.has(cls.id)
              const isTrialUser = activePurchase?.packageId === TRIAL_PACKAGE_ID
              const isBlockedForTrial = isTrialUser && new Date(cls.dateTime) >= TRIAL_CUTOFF_UTC
              const isPast = new Date(cls.dateTime) < getNowSV()
              const isDisabled = isFull || alreadyReserved || isBlockedForTrial || isPast

              return (
                <button
                  key={cls.id}
                  onClick={() => onClassClick(cls)}
                  disabled={isDisabled}
                  className={cn(
                    'w-full p-4 bg-white rounded-xl border-l-4 shadow-sm text-left transition-all min-h-[88px]',
                    cls.discipline.slug === 'yoga' ? 'border-l-[#9CAF88]' :
                    cls.discipline.slug === 'pilates' ? 'border-l-[#C4A77D]' :
                    cls.discipline.slug === 'pole' ? 'border-l-[#E5E5E5]' :
                    'border-l-primary',
                    isPast
                      ? 'opacity-50 cursor-not-allowed'
                      : isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-md active:scale-[0.98] cursor-pointer'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {cls.discipline.name}
                        {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline.name}`}
                      </span>
                      {cls.classType && (
                        <p className="text-xs text-gray-500 italic">{formatClassType(cls.classType)}</p>
                      )}
                      <div className="flex items-center gap-2 text-foreground">
                        <Clock className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span className="text-lg font-semibold">{format(new Date(cls.dateTime), 'HH:mm')}</span>
                        <span className="text-sm text-gray-500">({cls.duration} min)</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{cls.instructor.name}</span>
                      </div>
                    </div>
                    <div className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[70px]',
                      isPast ? 'bg-stone-100 text-stone-400' :
                      alreadyReserved ? 'bg-primary/10 text-primary' :
                      isBlockedForTrial ? 'bg-yellow-50 text-yellow-700' :
                      isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    )}>
                      {isPast ? (
                        <span className="text-xs font-medium text-center italic">Clase finalizada</span>
                      ) : alreadyReserved ? (
                        <>
                          <Check className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">Reservado</span>
                        </>
                      ) : isBlockedForTrial ? (
                        <span className="text-[10px] font-medium text-center leading-tight">Solo paquete pagado</span>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">
                            {isFull ? 'Lleno' : `${spotsLeft} cupos`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function ReservarPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const packageIdFromUrl = searchParams.get('packageId')
  const classIdFromUrl = searchParams.get('classId')

  // Data states
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [classes, setClasses] = React.useState<ClassData[]>([])
  const [activePurchase, setActivePurchase] = React.useState<ActivePurchase | null>(null)
  const [selectedPurchase, setSelectedPurchase] = React.useState<SelectedPurchase | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reservedClassIds, setReservedClassIds] = React.useState<Set<string>>(new Set())

  // Filter and navigation
  const [selectedDiscipline, setSelectedDiscipline] = React.useState('all')
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  })

  // Modal states - using single state to prevent duplicate modals
  const [modalState, setModalState] = React.useState<ModalState>('closed')
  const [selectedClass, setSelectedClass] = React.useState<ClassData | null>(null)
  const [isBooking, setIsBooking] = React.useState(false)
  const [bookingError, setBookingError] = React.useState<string | null>(null)

  // Guest invitation state
  const [bringGuest, setBringGuest] = React.useState(false)
  const [guestEmail, setGuestEmail] = React.useState('')
  const [guestName, setGuestName] = React.useState('')

  const weekDays = getWeekDays()

  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(currentWeekStart, i))
    }
    return dates
  }

  const weekDates = getWeekDates()

  // Memoize weekEnd to prevent infinite loop
  const weekEnd = React.useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
    [currentWeekStart]
  )

  // Fetch active purchase
  const fetchActivePurchase = React.useCallback(async () => {
    try {
      const response = await fetch('/api/user/active-purchase')
      if (response.ok) {
        const data = await response.json()
        setActivePurchase(data)
      }
    } catch (error) {
      console.error('Error fetching active purchase:', error)
    }
  }, [])

  // Fetch user's existing reservations to mark already-booked classes
  const fetchUserReservations = React.useCallback(async () => {
    try {
      const response = await fetch('/api/reservations')
      if (response.ok) {
        const data = await response.json()
        const ids = new Set<string>(
          data
            .filter((r: { status: string; isGuestReservation: boolean }) =>
              r.status === 'CONFIRMED' && !r.isGuestReservation
            )
            .map((r: { class: { id: string } }) => r.class.id)
        )
        setReservedClassIds(ids)
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
    }
  }, [])

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
    fetchActivePurchase()
    fetchUserReservations()
  }, [fetchActivePurchase, fetchUserReservations])

  // Re-fetch purchase data when tab becomes visible (sync across tabs)
  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchActivePurchase()
        fetchUserReservations()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchActivePurchase, fetchUserReservations])

  // Fetch specific purchase if packageId is in URL
  React.useEffect(() => {
    const fetchSelectedPurchase = async () => {
      if (!packageIdFromUrl) {
        setSelectedPurchase(null)
        return
      }

      try {
        const response = await fetch('/api/user/purchases')
        if (response.ok) {
          const data = await response.json()
          const purchase = data.activePurchases.find(
            (p: SelectedPurchase) => p.id === packageIdFromUrl
          )
          if (purchase) {
            setSelectedPurchase(purchase)
          }
        }
      } catch (error) {
        console.error('Error fetching selected purchase:', error)
      }
    }
    fetchSelectedPurchase()
  }, [packageIdFromUrl])

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

  // Track if we've already processed the classIdFromUrl to prevent reopening
  const [classIdProcessed, setClassIdProcessed] = React.useState(false)

  // Auto-select class from URL and open confirmation modal
  React.useEffect(() => {
    if (!classIdFromUrl || classIdProcessed) return

    const fetchAndSelectClass = async () => {
      try {
        // Fetch the specific class by ID
        const response = await fetch(`/api/classes/${classIdFromUrl}`)
        if (!response.ok) return

        const classData: ClassData = await response.json()

        // Navigate to the week containing this class
        const classDate = new Date(classData.dateTime)
        const classWeekStart = startOfWeek(classDate, { weekStartsOn: 1 })
        setCurrentWeekStart(classWeekStart)

        // Check if the class is full
        const reservationCount = classData._count?.reservations ?? classData.currentCount
        const isFull = reservationCount >= classData.maxCapacity

        if (!isFull) {
          setSelectedClass(classData)
          setBookingError(null)
          setModalState('confirm')
        }

        setClassIdProcessed(true)
      } catch (error) {
        console.error('Error fetching class:', error)
      }
    }

    fetchAndSelectClass()
  }, [classIdFromUrl, classIdProcessed])

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

  const formatClassDate = (dateTime: string) => {
    const date = new Date(dateTime)
    return format(date, 'EEEE, d MMMM')
  }

  const handleSelectClass = (cls: ClassData) => {
    const reservationCount = cls._count?.reservations ?? cls.currentCount
    const isFull = reservationCount >= cls.maxCapacity

    if (!isFull) {
      setSelectedClass(cls)
      setBookingError(null)
      setModalState('confirm')
    }
  }

  const handleConfirmBooking = async () => {
    if (!selectedClass) return

    setIsBooking(true)
    setBookingError(null)

    try {
      // Use selected purchase if available (from URL), otherwise API will use best available
      const purchaseIdToUse = selectedPurchase?.id || activePurchase?.purchaseId

      const body: Record<string, unknown> = {
        classId: selectedClass.id,
        purchaseId: purchaseIdToUse,
      }

      if (bringGuest && guestEmail) {
        body.guest = {
          email: guestEmail.trim(),
          name: guestName.trim() || undefined,
        }
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        // Use the updated purchase data from the response directly
        // This is more reliable than making another API call
        if (data.updatedPurchase) {
          // Update active purchase state with the response data
          setActivePurchase(prev => prev ? {
            ...prev,
            classesRemaining: data.updatedPurchase.classesRemaining,
          } : null)

          // Update selected purchase if applicable
          if (selectedPurchase && selectedPurchase.id === data.updatedPurchase.id) {
            setSelectedPurchase({
              ...selectedPurchase,
              classesRemaining: data.updatedPurchase.classesRemaining,
            })
          }
        }

        // Mark this class as reserved immediately
        setReservedClassIds(prev => new Set(prev).add(selectedClass.id))

        // Refresh classes to update spot counts (add cache bust param)
        const startDate = format(currentWeekStart, 'yyyy-MM-dd')
        const endDate = format(weekEnd, 'yyyy-MM-dd')
        const classesResponse = await fetch(
          `/api/classes?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`
        )
        if (classesResponse.ok) {
          const classesData = await classesResponse.json()
          setClasses(classesData)
        }
        setModalState('success')
      } else {
        setBookingError(data.error || 'Error al crear la reserva')
        setModalState('error')
      }
    } catch (error) {
      console.error('Error booking class:', error)
      setBookingError('Error de conexión. Por favor intenta de nuevo.')
      setModalState('error')
    } finally {
      setIsBooking(false)
    }
  }

  // Single close handler that completely resets modal state
  const closeModal = React.useCallback(() => {
    setModalState('closed')
    // Delay clearing selectedClass to prevent flash during close animation
    setTimeout(() => {
      setSelectedClass(null)
      setBookingError(null)
      setBringGuest(false)
      setGuestEmail('')
      setGuestName('')
    }, 150)
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Reservar Clase
        </h1>
        <p className="text-gray-600 mt-1">
          Selecciona una clase para reservar tu espacio
        </p>
      </div>

      {/* User's available classes - show selected package if from URL, otherwise show general info */}
      <Card>
        <CardContent className="p-4">
          {selectedPurchase ? (
            // Show specific package from URL
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Usando paquete</p>
                  <p className="font-medium text-foreground">{selectedPurchase.packageName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-serif font-semibold text-primary">
                  {selectedPurchase.classesRemaining}
                </p>
                <p className="text-xs text-gray-500">clases restantes</p>
              </div>
            </div>
          ) : (
            // Show general active purchase info
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Clases disponibles</p>
                <p className="text-2xl font-serif font-semibold text-primary">
                  {activePurchase?.classesRemaining ?? '-'}
                </p>
              </div>
              {activePurchase?.hasActivePackage ? (
                <Badge variant="success">Paquete activo</Badge>
              ) : (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => router.push('/paquetes')}>
                  Sin paquete activo
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        {/* Week navigation - centered */}
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

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Mobile Agenda View */}
          <div className="md:hidden space-y-3">
            {weekDates.map((date, index) => {
              const dayClasses = getClassesForDay(date)
              const today = isToday(date)
              return (
                <MobileDaySection
                  key={index}
                  date={date}
                  classes={dayClasses}
                  isToday={today}
                  weekDays={weekDays}
                  reservedClassIds={reservedClassIds}
                  activePurchase={activePurchase}
                  onClassClick={handleSelectClass}
                />
              )
            })}
          </div>

          {/* Desktop Calendar Grid */}
          <Card className="hidden md:block overflow-hidden">
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
                        const alreadyReserved = reservedClassIds.has(cls.id)
                        const isTrialUser = activePurchase?.packageId === TRIAL_PACKAGE_ID
                        const isBlockedForTrial = isTrialUser && new Date(cls.dateTime) >= TRIAL_CUTOFF_UTC
                        const isPast = new Date(cls.dateTime) < getNowSV()
                        const isDisabled = isFull || alreadyReserved || isBlockedForTrial || isPast

                        return (
                          <button
                            key={cls.id}
                            onClick={() => handleSelectClass(cls)}
                            disabled={isDisabled}
                            title={isPast ? 'Clase finalizada' : isBlockedForTrial ? 'Tu paquete de prueba solo aplica hasta el 7 de marzo' : undefined}
                            className={cn(
                              'w-full p-2 rounded-lg text-white text-xs text-left transition-all',
                              disciplineColors[cls.discipline.slug] || 'bg-primary',
                              isPast
                                ? 'opacity-40 cursor-not-allowed'
                                : isDisabled
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:scale-[1.02] hover:shadow-md cursor-pointer'
                            )}
                          >
                            <p className="font-medium">
                              {cls.discipline.name}
                              {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline.name}`}
                            </p>
                            <p className="flex items-center gap-1 opacity-90">
                              <Clock className="h-3 w-3" />
                              {formatClassTime(cls.dateTime)}
                            </p>
                            <p className="flex items-center gap-1 opacity-90">
                              <User className="h-3 w-3" />
                              {cls.instructor.name.split(' ')[0]}
                            </p>
                            <p className="flex items-center gap-1 mt-1">
                              {isPast ? (
                                <span className="italic">Finalizada</span>
                              ) : alreadyReserved ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Ya reservado
                                </>
                              ) : isBlockedForTrial ? (
                                <span className="text-[10px]">Solo paquete pagado</span>
                              ) : (
                                <>
                                  <Users className="h-3 w-3" />
                                  {isFull ? 'Lleno' : `${spotsLeft} cupos`}
                                </>
                              )}
                            </p>
                          </button>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      {/* Confirmation Modal - Single modal with different content based on state */}
      <Modal open={modalState !== 'closed'} onOpenChange={(open) => !open && closeModal()}>
        <ModalContent>
          {/* Success State */}
          {modalState === 'success' && (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  ¡Reserva Confirmada!
                </h3>
                <p className="text-gray-600">
                  Tu lugar en la clase ha sido reservado.
                  {selectedPurchase ? (
                    <>
                      {' '}En tu paquete <span className="font-semibold">{selectedPurchase.packageName}</span> te quedan{' '}
                      <span className="font-semibold text-primary">
                        {selectedPurchase.classesRemaining}
                      </span>{' '}
                      clases.
                    </>
                  ) : (
                    <>
                      {' '}Te quedan{' '}
                      <span className="font-semibold text-primary">
                        {activePurchase?.classesRemaining ?? 0}
                      </span>{' '}
                      clases disponibles.
                    </>
                  )}
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closeModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          )}

          {/* Error State */}
          {modalState === 'error' && (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  Error en la Reserva
                </h3>
                <p className="text-gray-600">{bookingError}</p>
              </div>
              <ModalFooter>
                <Button variant="ghost" onClick={closeModal}>
                  Cerrar
                </Button>
                <Button onClick={() => setModalState('confirm')}>
                  Intentar de nuevo
                </Button>
              </ModalFooter>
            </>
          )}

          {/* Confirmation State */}
          {modalState === 'confirm' && selectedClass && (
            <>
              <ModalHeader>
                <ModalTitle>Confirmar Reserva</ModalTitle>
                <ModalDescription>
                  Revisa los detalles antes de confirmar
                </ModalDescription>
              </ModalHeader>

              <div className="space-y-4">
                <div
                  className={cn(
                    'p-4 rounded-xl text-white',
                    disciplineColors[selectedClass.discipline.slug] || 'bg-primary'
                  )}
                >
                  <p className="font-serif text-xl font-semibold">
                    {selectedClass.discipline.name}
                    {selectedClass.complementaryDiscipline && ` + ${selectedClass.complementaryDiscipline.name}`}
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha</span>
                    <span className="font-medium">{formatClassDate(selectedClass.dateTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Instructor</span>
                    <span className="font-medium">{selectedClass.instructor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hora</span>
                    <span className="font-medium">{formatClassTime(selectedClass.dateTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duración</span>
                    <span className="font-medium">{selectedClass.duration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cupos disponibles</span>
                    <span className="font-medium">
                      {selectedClass.maxCapacity - (selectedClass._count?.reservations ?? selectedClass.currentCount)}
                    </span>
                  </div>
                </div>

                {/* Guest invitation toggle — only for shareable packages */}
                {activePurchase?.package?.isShareable && (
                  <div className="border border-beige rounded-lg p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bringGuest}
                        onChange={(e) => setBringGuest(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">
                          Llevar un invitado a esta clase
                        </span>
                      </div>
                    </label>

                    {bringGuest && (
                      <div className="space-y-3 pl-7">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Email del invitado *
                          </label>
                          <input
                            type="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="invitado@email.com"
                            required
                            className="w-full px-3 py-2 border border-beige rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Nombre del invitado (opcional)
                          </label>
                          <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Nombre"
                            className="w-full px-3 py-2 border border-beige rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Se descontará 1 clase de tu paquete. Tu invitado asiste gratis como acompañante.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Classes deduction info */}
                {(() => {
                  const classesToDeduct = 1 // Always 1 — guest is free companion
                  const remaining = selectedPurchase
                    ? selectedPurchase.classesRemaining
                    : (activePurchase?.classesRemaining || 0)
                  const packageName = selectedPurchase
                    ? selectedPurchase.packageName
                    : 'tu paquete activo'

                  return (
                    <div className="p-3 bg-beige rounded-lg text-sm">
                      <p className="text-gray-600">
                        {selectedPurchase ? (
                          <>
                            Se {classesToDeduct === 1 ? 'descontará 1 clase' : 'descontarán 2 clases'} de tu paquete <span className="font-semibold">{packageName}</span>.
                            <span className="block mt-1">
                              Clases restantes después de reservar:{' '}
                              <span className="font-semibold">
                                {Math.max(0, remaining - classesToDeduct)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            Se {classesToDeduct === 1 ? 'descontará 1 clase' : 'descontarán 2 clases'} de {packageName}.
                            {activePurchase && (
                              <span className="block mt-1">
                                Clases restantes después de reservar:{' '}
                                <span className="font-semibold">
                                  {Math.max(0, remaining - classesToDeduct)}
                                </span>
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  )
                })()}
              </div>

              <ModalFooter>
                <Button variant="ghost" onClick={closeModal} disabled={isBooking}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmBooking}
                  isLoading={isBooking}
                  disabled={bringGuest && !guestEmail.trim()}
                >
                  {bringGuest ? 'Reservar con Invitado' : 'Confirmar Reserva'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
