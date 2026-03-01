'use client'

import * as React from 'react'
import Link from 'next/link'
import { Calendar, Users, UserCheck, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface AttendanceClass {
  id: string
  dateTime: string
  duration: number
  classType: string | null
  maxCapacity: number
  discipline: { id: string; name: string; slug: string }
  instructor: { id: string; name: string }
  totalReservations: number
  checkedInCount: number
}

const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#9CAF88]',
  pilates: 'bg-[#C4A77D]',
  pole: 'bg-[#E5E5E5]',
  soundbath: 'bg-[#F5E9DD]',
  'terapia-de-sonido': 'bg-[#F5E9DD]',
  nutricion: 'bg-[#6B7F5E]',
}

function formatDateSV(date: Date): string {
  return date.toLocaleDateString('es-SV', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTimeSV(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function getClassStatus(dateTime: string, duration: number): 'upcoming' | 'active' | 'ended' {
  const now = new Date()
  const start = new Date(dateTime)
  const end = new Date(start.getTime() + duration * 60000)
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'active'
}

export default function AsistenciasPage() {
  const [classes, setClasses] = React.useState<AttendanceClass[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  const fetchClasses = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await fetch(`/api/admin/attendance/classes?date=${dateStr}`)
      if (response.ok) {
        const data = await response.json()
        setClasses(data)
      }
    } catch (error) {
      console.error('Error fetching attendance classes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

  React.useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  const goToPreviousDay = () => {
    setSelectedDate(new Date(selectedDate.getTime() - 86400000))
  }

  const goToNextDay = () => {
    setSelectedDate(new Date(selectedDate.getTime() + 86400000))
  }

  const goToToday = () => {
    const now = new Date()
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  }

  const totalReservations = classes.reduce((sum, c) => sum + c.totalReservations, 0)
  const totalCheckedIn = classes.reduce((sum, c) => sum + c.checkedInCount, 0)
  const attendanceRate = totalReservations > 0 ? Math.round((totalCheckedIn / totalReservations) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Asistencias</h1>
        <p className="text-gray-600 mt-1">Control de asistencias y check-in con QR</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-[250px]">
          <p className="font-medium text-foreground capitalize">{formatDateSV(selectedDate)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={goToNextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2 text-primary">
          Hoy
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-foreground">{classes.length}</p>
              <p className="text-sm text-gray-500">Clases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-foreground">{totalReservations}</p>
              <p className="text-sm text-gray-500">Reservas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-semibold text-foreground">
                {totalCheckedIn} <span className="text-sm font-normal text-gray-500">({attendanceRate}%)</span>
              </p>
              <p className="text-sm text-gray-500">Presentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="font-medium text-foreground mb-2">Sin clases este día</h3>
            <p className="text-gray-600">No hay clases programadas para esta fecha.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const status = getClassStatus(cls.dateTime, cls.duration)
            const progress = cls.totalReservations > 0
              ? (cls.checkedInCount / cls.totalReservations) * 100
              : 0

            return (
              <Link key={cls.id} href={`/admin/asistencias/${cls.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                  <div className="flex">
                    <div className={`w-2 ${disciplineColors[cls.discipline.slug] || 'bg-primary'}`} />
                    <CardContent className="flex-1 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-lg font-semibold text-foreground">
                              {cls.discipline.name}
                            </h3>
                            {cls.classType && (
                              <span className="text-xs text-gray-500">({cls.classType})</span>
                            )}
                            <Badge
                              variant={status === 'active' ? 'success' : status === 'ended' ? 'secondary' : 'default'}
                            >
                              {status === 'active' ? 'En curso' : status === 'ended' ? 'Finalizada' : 'Próxima'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTimeSV(cls.dateTime)} ({cls.duration} min)
                            </span>
                            <span>{cls.instructor.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">
                              {cls.checkedInCount}/{cls.totalReservations}
                            </p>
                            <p className="text-xs text-gray-500">presentes</p>
                          </div>
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                progress === 100 ? 'bg-green-500' : 'bg-primary'
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
