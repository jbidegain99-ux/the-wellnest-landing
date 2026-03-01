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
import { cn, getWeekDays, getMonthName, formatClassType } from '@/lib/utils'
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
  const [hasComplementary, setHasComplementary] = React.useState(false)
  const [selectedComplementaryId, setSelectedComplementaryId] = React.useState<string>('')
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

      const response = await fetch(
        `/api/admin/classes?startDate=${startOfWeek.toISOString()}&endDate=${weekEnd.toISOString()}`
      )

      if (response.ok) {
        const data = await response.json()
        setClasses(data)
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
          setDisciplines(disciplinesData)
        }

        if (instructorsRes.ok) {
          const instructorsData = await instructorsRes.json()
          setInstructors(instructorsData)
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

    return filtered.sort((a, b) => a.time.localeCompare(b.time))
  }

  const getDisciplineColorForClass = (disciplineName: string) => {
    // First try exact match with loaded disciplines
    const discipline = disciplines.find(d => d.name === disciplineName)
    if (discipline) {
      return getDisciplineColor(discipline.slug)
    }

    // Fallback: normalize the class discipline name and look up directly in color map
    // This handles cases where class has "Mat Pilates" but discipline is "Pilates"
    const normalizedName = disciplineName.toLowerCase().replace(/\s+/g, '-')
    const directColor = disciplineColors[normalizedName]
    if (directColor) {
      return directColor
    }

    // Additional fallback mappings for common cases
    const fallbackMappings: Record<string, string> = {
      'yoga': 'bg-[#6A6F4C]',
      'pilates': 'bg-[#806044]',
      'mat-pilates': 'bg-[#806044]',
      'mat pilates': 'bg-[#806044]',
      'pole': 'bg-[#806044]',
      'pole-fitness': 'bg-[#806044]',
      'pole fitness': 'bg-[#806044]',
      'soundbath': 'bg-[#482F21]',
      'terapia-de-sonido': 'bg-[#482F21]',
      'terapia de sonido': 'bg-[#482F21]',
      'nutricion': 'bg-[#6B7F5E]',
      'nutrición': 'bg-[#6B7F5E]',
      'nutrition': 'bg-[#6B7F5E]',
    }

    const lowerName = disciplineName.toLowerCase()
    if (fallbackMappings[lowerName]) {
      return fallbackMappings[lowerName]
    }

    // Ultimate fallback: visible gray color (not bg-primary which may be transparent)
    return 'bg-gray-600'
  }

  const handleCreate = (dayOfWeek?: number) => {
    setEditingClass(null)
    setSelectedDay(dayOfWeek ?? null)
    // Reset controlled state for new class
    setSelectedDisciplineId('')
    setHasComplementary(false)
    setSelectedComplementaryId('')
    setSelectedInstructorId('')
    setSelectedDayOfWeek(dayOfWeek !== undefined ? dayOfWeek.toString() : '')
    setIsModalOpen(true)
  }

  const handleEdit = (cls: ClassItem) => {
    setEditingClass(cls)
    setSelectedDay(null)
    // Set controlled state from existing class
    setSelectedDisciplineId(cls.disciplineId)
    setHasComplementary(!!cls.complementaryDisciplineId)
    setSelectedComplementaryId(cls.complementaryDisciplineId || '')
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
      const complementaryDisciplineId = hasComplementary && selectedComplementaryId
        ? selectedComplementaryId
        : null

      if (editingClass) {
        // Update existing class
        const response = await fetch(`/api/admin/classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disciplineId,
            complementaryDisciplineId,
            instructorId,
            time: formData.get('time') as string,
            duration: parseInt(formData.get('duration') as string),
            maxCapacity: parseInt(formData.get('maxCapacity') as string),
            classType: (formData.get('classType') as string) || null,
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
            complementaryDisciplineId,
            instructorId,
            dayOfWeek: parseInt(dayOfWeek),
            time: formData.get('time') as string,
            duration: parseInt(formData.get('duration') as string),
            maxCapacity: parseInt(formData.get('maxCapacity') as string),
            classType: (formData.get('classType') as string) || null,
            isRecurring: formData.get('isRecurring') === 'on',
            weeksAhead: formData.get('isRecurring') === 'on' ? 8 : 1,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          showError(data.error || 'Error al crear la clase')
          return
        }

        showSuccess(data.message || 'Clase creada correctamente')
      }

      // Refresh classes
      await fetchClasses()
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
        <div className="grid grid-cols-7 min-h-[500px] max-h-[700px]">
          {weekDates.map((date, dayIndex) => {
            const dayClasses = getClassesForDay(date)
            return (
              <div
                key={dayIndex}
                className="border-r last:border-r-0 border-beige p-2 space-y-2 overflow-y-auto max-h-[650px]"
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
                    <p className="font-medium">
                      {cls.discipline}
                      {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline}`}
                    </p>
                    {cls.classType && (
                      <p className="opacity-75 italic text-[10px] truncate">{formatClassType(cls.classType)}</p>
                    )}
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasComplementary}
                    onChange={(e) => {
                      setHasComplementary(e.target.checked)
                      if (!e.target.checked) setSelectedComplementaryId('')
                    }}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">¿Tiene disciplina complementaria?</span>
                </label>
                {hasComplementary && (
                  <div className="mt-2">
                    <Select
                      value={selectedComplementaryId}
                      onValueChange={setSelectedComplementaryId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar disciplina complementaria" />
                      </SelectTrigger>
                      <SelectContent>
                        {disciplines
                          .filter((d) => d.id !== selectedDisciplineId)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de Clase (opcional)
                </label>
                <input
                  type="text"
                  name="classType"
                  placeholder="ej: clase de prueba, Pilates - Core, Yoga - Vinyasa"
                  className="w-full px-3 py-2 border border-beige rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  defaultValue={editingClass?.classType || ''}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Subtítulo categórico que aparece en las cards de horarios
                </p>
              </div>

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
