'use client'

import * as React from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
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
import { cn, getWeekDays, getMonthName } from '@/lib/utils'
import { disciplineColors, getDisciplineColor } from '@/config/disciplineColors'

interface Discipline {
  id: string
  name: string
  slug: string
}

interface Instructor {
  id: string
  name: string
  disciplines: string[]
}

interface ClassItem {
  id: string
  disciplineId: string
  discipline: string
  instructorId: string
  instructor: string
  dateTime: string
  time: string
  duration: number
  maxCapacity: number
  dayOfWeek: number
  isRecurring: boolean
  isCancelled?: boolean
  reservationsCount?: number
}

// Colores importados desde @/config/disciplineColors (fuente única de verdad)

export default function AdminHorariosPage() {
  // Data from database
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [instructors, setInstructors] = React.useState<Instructor[]>([])
  const [isDataLoading, setIsDataLoading] = React.useState(true)

  // Classes from database
  const [classes, setClasses] = React.useState<ClassItem[]>([])
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingClass, setEditingClass] = React.useState<ClassItem | null>(null)
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null)

  // Controlled state for form selects (Radix Select + FormData is unreliable)
  const [selectedDisciplineId, setSelectedDisciplineId] = React.useState<string>('')
  const [selectedInstructorId, setSelectedInstructorId] = React.useState<string>('')
  const [selectedDayOfWeek, setSelectedDayOfWeek] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() => {
    const today = new Date()
    const day = today.getDay()
    // Calculate Monday of current week (or previous Monday if today is Sunday)
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    // Reset to midnight to ensure consistent date comparisons
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setErrorMessage(null)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setSuccessMessage(null)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  // Fetch classes for the current week
  const fetchClasses = React.useCallback(async () => {
    try {
      // Create start date at midnight local time to include all classes of the day
      const startOfWeek = new Date(currentWeekStart)
      startOfWeek.setHours(0, 0, 0, 0)

      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      console.log('[ADMIN HORARIOS] Fetching classes:', {
        startLocal: startOfWeek.toLocaleString(),
        endLocal: weekEnd.toLocaleString(),
        startISO: startOfWeek.toISOString(),
        endISO: weekEnd.toISOString(),
      })

      const response = await fetch(
        `/api/admin/classes?startDate=${startOfWeek.toISOString()}&endDate=${weekEnd.toISOString()}`
      )

      if (response.ok) {
        const data = await response.json()
        console.log('[ADMIN HORARIOS] fetchClasses() received:', data.length, 'classes')

        // Desglose por disciplina
        const byDiscipline: Record<string, number> = {}
        data.forEach((cls: ClassItem) => {
          byDiscipline[cls.discipline] = (byDiscipline[cls.discipline] || 0) + 1
        })
        console.log('[ADMIN HORARIOS] Desglose por disciplina:', byDiscipline)

        setClasses(data)
      } else {
        console.error('[ADMIN HORARIOS] fetchClasses() failed:', response.status)
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
    }
  }, [currentWeekStart])

  // Fetch disciplines and instructors from database
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [disciplinesRes, instructorsRes] = await Promise.all([
          fetch('/api/disciplines'),
          fetch('/api/admin/instructors'),
        ])

        if (disciplinesRes.ok) {
          const disciplinesData = await disciplinesRes.json()
          console.log('[ADMIN HORARIOS] Disciplines loaded:', disciplinesData.map((d: Discipline) => ({
            id: d.id,
            name: d.name,
            slug: d.slug,
          })))
          setDisciplines(disciplinesData)
        } else {
          console.error('[ADMIN HORARIOS] Failed to load disciplines:', disciplinesRes.status)
        }

        if (instructorsRes.ok) {
          const instructorsData = await instructorsRes.json()
          console.log('[ADMIN HORARIOS] Instructors loaded:', instructorsData.map((i: Instructor) => ({
            id: i.id,
            name: i.name,
          })))
          setInstructors(instructorsData)
        } else {
          console.error('[ADMIN HORARIOS] Failed to load instructors:', instructorsRes.status)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsDataLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch classes when week changes
  React.useEffect(() => {
    if (!isDataLoading) {
      fetchClasses()
    }
  }, [currentWeekStart, isDataLoading, fetchClasses])

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

  // Helper to get date string in El Salvador timezone (UTC-6)
  // This ensures calendar displays correctly regardless of browser timezone
  const getElSalvadorDateStr = (utcDateStr: string): string => {
    const date = new Date(utcDateStr)
    // El Salvador is UTC-6, subtract 6 hours from UTC to get local time
    const elSalvadorTime = new Date(date.getTime() - 6 * 60 * 60 * 1000)
    return `${elSalvadorTime.getUTCFullYear()}-${String(elSalvadorTime.getUTCMonth() + 1).padStart(2, '0')}-${String(elSalvadorTime.getUTCDate()).padStart(2, '0')}`
  }

  const getClassesForDay = (date: Date) => {
    // Filter classes for this specific date
    // IMPORTANT: Compare dates in El Salvador timezone for correct display
    // The calendar shows El Salvador local dates, so classes must match that timezone
    const targetDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    const filtered = classes.filter((cls) => {
      // Convert UTC class datetime to El Salvador date string
      const classDateStr = getElSalvadorDateStr(cls.dateTime)
      return classDateStr === targetDateStr
    })

    // Debug logging for any day that has issues
    if (date.getDay() === 2 && classes.length > 0) { // Tuesday - day the user tested
      console.log('[ADMIN HORARIOS] getClassesForDay debug for Tuesday:', {
        targetDate: targetDateStr,
        totalClasses: classes.length,
        matchedClasses: filtered.length,
        sampleClassDates: classes.slice(0, 5).map(c => ({
          discipline: c.discipline,
          dateTimeRaw: c.dateTime,
          elSalvadorDate: getElSalvadorDateStr(c.dateTime),
        })),
      })
    }

    return filtered.sort((a, b) => a.time.localeCompare(b.time))
  }

  const getDisciplineColorForClass = (disciplineName: string) => {
    const discipline = disciplines.find(d => d.name === disciplineName)
    return discipline ? getDisciplineColor(discipline.slug) : 'bg-primary'
  }

  const handleCreate = (dayOfWeek?: number) => {
    setEditingClass(null)
    setSelectedDay(dayOfWeek ?? null)
    // Reset controlled state for new class
    setSelectedDisciplineId('')
    setSelectedInstructorId('')
    setSelectedDayOfWeek(dayOfWeek !== undefined ? dayOfWeek.toString() : '')
    setIsModalOpen(true)
  }

  const handleEdit = (cls: ClassItem) => {
    setEditingClass(cls)
    setSelectedDay(null)
    // Set controlled state from existing class
    setSelectedDisciplineId(cls.disciplineId)
    setSelectedInstructorId(cls.instructorId)
    setSelectedDayOfWeek(cls.dayOfWeek.toString())
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)

    // Use controlled state instead of FormData for Select values (Radix Select + FormData is unreliable)
    const disciplineId = selectedDisciplineId
    const instructorId = selectedInstructorId
    const dayOfWeek = selectedDayOfWeek

    // DEBUG: Log form data for verification
    console.log('[ADMIN HORARIOS] ========== FORM SUBMIT ==========')
    console.log('[ADMIN HORARIOS] Using CONTROLLED STATE (not FormData):')
    console.log('[ADMIN HORARIOS] disciplineId:', disciplineId)
    console.log('[ADMIN HORARIOS] instructorId:', instructorId)
    console.log('[ADMIN HORARIOS] dayOfWeek:', dayOfWeek)
    console.log('[ADMIN HORARIOS] Available disciplines:', disciplines.map(d => ({ id: d.id, name: d.name, slug: d.slug })))
    console.log('[ADMIN HORARIOS] Available instructors:', instructors.map(i => ({ id: i.id, name: i.name })))

    // Validate that we have the required IDs
    if (!disciplineId) {
      showError('Error: Debes seleccionar una disciplina')
      setIsLoading(false)
      return
    }
    if (!instructorId) {
      showError('Error: Debes seleccionar un instructor')
      setIsLoading(false)
      return
    }
    if (!editingClass && !dayOfWeek) {
      showError('Error: Debes seleccionar un día de la semana')
      setIsLoading(false)
      return
    }

    try {
      if (editingClass) {
        // Update existing class
        const response = await fetch(`/api/admin/classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disciplineId,
            instructorId,
            time: formData.get('time') as string,
            duration: parseInt(formData.get('duration') as string),
            maxCapacity: parseInt(formData.get('maxCapacity') as string),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          showError(data.error || 'Error al actualizar la clase')
          return
        }

        showSuccess('Clase actualizada correctamente')
      } else {
        // Create new class(es)
        const response = await fetch('/api/admin/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disciplineId,
            instructorId,
            dayOfWeek: parseInt(dayOfWeek),
            time: formData.get('time') as string,
            duration: parseInt(formData.get('duration') as string),
            maxCapacity: parseInt(formData.get('maxCapacity') as string),
            isRecurring: formData.get('isRecurring') === 'on',
            weeksAhead: formData.get('isRecurring') === 'on' ? 8 : 1,
          }),
        })

        const data = await response.json()

        console.log('[ADMIN HORARIOS] === POST RESPONSE ===')
        console.log('[ADMIN HORARIOS] Status:', response.status)
        console.log('[ADMIN HORARIOS] Response data:', JSON.stringify(data, null, 2))

        if (!response.ok) {
          console.log('[ADMIN HORARIOS] ERROR - No cerrando modal')
          showError(data.error || 'Error al crear la clase')
          return
        }

        console.log('[ADMIN HORARIOS] SUCCESS - Refreshing classes...')
        showSuccess(data.message || 'Clase creada correctamente')
      }

      // Refresh classes
      console.log('[ADMIN HORARIOS] Calling fetchClasses()...')
      await fetchClasses()
      console.log('[ADMIN HORARIOS] fetchClasses() completed, closing modal')
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error saving class:', error)
      showError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/classes/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || 'Error al eliminar la clase')
        setDeleteConfirmId(null)
        setIsModalOpen(false)
        return
      }

      showSuccess('Clase eliminada correctamente')
      await fetchClasses()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error deleting class:', error)
      showError('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Horarios
          </h1>
          <p className="text-gray-600 mt-1">
            Administra el calendario de clases
          </p>
        </div>
        <Button onClick={() => handleCreate()}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Clase
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {errorMessage}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={goToPreviousWeek}
          className="p-2 rounded-full hover:bg-beige transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-medium text-foreground min-w-[200px] text-center">
          {getMonthName(currentWeekStart.getMonth())} {currentWeekStart.getFullYear()}
        </span>
        <button
          onClick={goToNextWeek}
          className="p-2 rounded-full hover:bg-beige transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        {/* Days header */}
        <div className="grid grid-cols-7 border-b border-beige">
          {weekDates.map((date, index) => (
            <div key={index} className="p-4 text-center border-r last:border-r-0 border-beige">
              <p className="text-sm text-gray-500">{weekDays[date.getDay()]}</p>
              <p className="font-serif text-xl font-semibold text-foreground">
                {date.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Classes grid */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {weekDates.map((date, dayIndex) => {
            const dayClasses = getClassesForDay(date)
            return (
              <div
                key={dayIndex}
                className="border-r last:border-r-0 border-beige p-2 space-y-2"
              >
                {dayClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className={cn(
                      'p-2 rounded-lg text-white text-xs cursor-pointer hover:opacity-90 transition-opacity',
                      cls.isCancelled ? 'bg-gray-400' : getDisciplineColorForClass(cls.discipline)
                    )}
                    onClick={() => handleEdit(cls)}
                  >
                    <p className="font-medium">{cls.discipline}</p>
                    <p className="opacity-90">{cls.time}</p>
                    <p className="opacity-90">{cls.instructor.split(' ')[0]}</p>
                    <p className="opacity-90">
                      {cls.reservationsCount || 0}/{cls.maxCapacity} cupos
                    </p>
                    {cls.isCancelled && (
                      <p className="text-[10px] font-medium uppercase mt-1">Cancelada</p>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => handleCreate(date.getDay())}
                  className="w-full p-2 border-2 border-dashed border-beige-dark rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors text-xs"
                >
                  + Agregar
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              {editingClass ? 'Editar Clase' : 'Nueva Clase'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Disciplina
                </label>
                <Select
                  value={selectedDisciplineId}
                  onValueChange={setSelectedDisciplineId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplines.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Instructor
                </label>
                <Select
                  value={selectedInstructorId}
                  onValueChange={setSelectedInstructorId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!editingClass && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Día de la semana
                  </label>
                  <Select
                    value={selectedDayOfWeek}
                    onValueChange={setSelectedDayOfWeek}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((day, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Hora"
                  name="time"
                  type="time"
                  defaultValue={editingClass?.time}
                  required
                />
                <Input
                  label="Duración (min)"
                  name="duration"
                  type="number"
                  min="15"
                  defaultValue={editingClass?.duration || 60}
                  required
                />
              </div>

              <Input
                label="Capacidad máxima"
                name="maxCapacity"
                type="number"
                min="1"
                defaultValue={editingClass?.maxCapacity || 15}
                required
              />

              {!editingClass && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    defaultChecked={true}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Clase recurrente (crear para las próximas 8 semanas / 2 meses)</span>
                </label>
              )}

              {editingClass && editingClass.reservationsCount && editingClass.reservationsCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Esta clase tiene {editingClass.reservationsCount} reservación(es) activa(s).
                </div>
              )}
            </div>

            <ModalFooter>
              {editingClass && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteConfirmId(editingClass.id)}
                  className="mr-auto text-[var(--color-error)]"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {editingClass ? 'Guardar Cambios' : 'Crear Clase'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onOpenChange={() => !isDeleting && setDeleteConfirmId(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Confirmar eliminación</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <p className="text-gray-600">
              ¿Estás segura de que deseas eliminar esta clase? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1"
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                isLoading={isDeleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  )
}
