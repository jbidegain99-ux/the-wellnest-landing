'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { ChevronLeft, ChevronRight, Clock, User, Users, Check } from 'lucide-react'
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
import { cn, formatDate, formatTime, getWeekDays, getMonthName } from '@/lib/utils'

// Sample data
const sampleClasses = [
  {
    id: '1',
    discipline: 'Yoga',
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
    instructor: 'Ana Martínez',
    time: '08:00',
    duration: 55,
    maxCapacity: 12,
    currentCount: 8,
    dayOfWeek: 1,
  },
  {
    id: '3',
    discipline: 'Yoga',
    instructor: 'Laura Vega',
    time: '10:00',
    duration: 75,
    maxCapacity: 15,
    currentCount: 6,
    dayOfWeek: 2,
  },
  {
    id: '4',
    discipline: 'Pole Sport',
    instructor: 'Carolina López',
    time: '18:00',
    duration: 60,
    maxCapacity: 8,
    currentCount: 5,
    dayOfWeek: 3,
  },
  {
    id: '5',
    discipline: 'Sound Healing',
    instructor: 'Sofía Hernández',
    time: '19:30',
    duration: 90,
    maxCapacity: 20,
    currentCount: 15,
    dayOfWeek: 4,
  },
]

const disciplineColors: Record<string, string> = {
  Yoga: 'bg-[#9CAF88] border-[#9CAF88]',
  'Pilates Mat': 'bg-[#C4A77D] border-[#C4A77D]',
  'Pole Sport': 'bg-[#D4A574] border-[#D4A574]',
  'Sound Healing': 'bg-[#8B7355] border-[#8B7355]',
}

export default function ReservarPage() {
  const { data: session } = useSession()
  const [selectedDiscipline, setSelectedDiscipline] = React.useState('all')
  const [selectedClass, setSelectedClass] = React.useState<typeof sampleClasses[0] | null>(null)
  const [showConfirmation, setShowConfirmation] = React.useState(false)
  const [isBooking, setIsBooking] = React.useState(false)
  const [bookingSuccess, setBookingSuccess] = React.useState(false)
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
          cls.discipline.toLowerCase().replace(' ', '') === selectedDiscipline
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

  const handleSelectClass = (cls: typeof sampleClasses[0]) => {
    const isFull = cls.currentCount >= cls.maxCapacity
    if (!isFull) {
      setSelectedClass(cls)
      setShowConfirmation(true)
    }
  }

  const handleConfirmBooking = async () => {
    setIsBooking(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsBooking(false)
    setBookingSuccess(true)
  }

  const closeModal = () => {
    setShowConfirmation(false)
    setSelectedClass(null)
    setBookingSuccess(false)
  }

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

      {/* User's available classes */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clases disponibles</p>
              <p className="text-2xl font-serif font-semibold text-primary">5</p>
            </div>
            <Badge variant="success">Paquete activo</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
            <SelectItem value="yoga">Yoga</SelectItem>
            <SelectItem value="pilatesmat">Pilates Mat</SelectItem>
            <SelectItem value="polesport">Pole Sport</SelectItem>
            <SelectItem value="soundhealing">Sound Healing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
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
                      <button
                        key={cls.id}
                        onClick={() => handleSelectClass(cls)}
                        disabled={isFull}
                        className={cn(
                          'w-full p-2 rounded-lg text-white text-xs text-left transition-all',
                          disciplineColors[cls.discipline]?.split(' ')[0],
                          isFull
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:scale-[1.02] hover:shadow-md cursor-pointer'
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
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal open={showConfirmation} onOpenChange={closeModal}>
        <ModalContent>
          {bookingSuccess ? (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  ¡Reserva Confirmada!
                </h3>
                <p className="text-gray-600">
                  Tu lugar en la clase ha sido reservado. Recibirás un email de
                  confirmación.
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closeModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>Confirmar Reserva</ModalTitle>
                <ModalDescription>
                  Revisa los detalles antes de confirmar
                </ModalDescription>
              </ModalHeader>

              {selectedClass && (
                <div className="space-y-4">
                  <div
                    className={cn(
                      'p-4 rounded-xl text-white',
                      disciplineColors[selectedClass.discipline]?.split(' ')[0]
                    )}
                  >
                    <p className="font-serif text-xl font-semibold">
                      {selectedClass.discipline}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Instructor</span>
                      <span className="font-medium">{selectedClass.instructor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hora</span>
                      <span className="font-medium">{selectedClass.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duración</span>
                      <span className="font-medium">{selectedClass.duration} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cupos disponibles</span>
                      <span className="font-medium">
                        {selectedClass.maxCapacity - selectedClass.currentCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-beige rounded-lg text-sm">
                    <p className="text-gray-600">
                      Se descontará 1 clase de tu paquete activo.
                    </p>
                  </div>
                </div>
              )}

              <ModalFooter>
                <Button variant="ghost" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmBooking} isLoading={isBooking}>
                  Confirmar Reserva
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
