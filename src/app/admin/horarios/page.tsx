'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
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

const disciplines = [
  { id: '1', name: 'Yoga' },
  { id: '2', name: 'Pilates Mat' },
  { id: '3', name: 'Pole Sport' },
  { id: '4', name: 'Sound Healing' },
]

const instructors = [
  { id: '1', name: 'María García' },
  { id: '2', name: 'Ana Martínez' },
  { id: '3', name: 'Carolina López' },
  { id: '4', name: 'Sofía Hernández' },
  { id: '5', name: 'Laura Vega' },
]

// Mock schedule data
const initialClasses = [
  {
    id: '1',
    disciplineId: '1',
    discipline: 'Yoga',
    instructorId: '1',
    instructor: 'María García',
    time: '06:00',
    duration: 60,
    maxCapacity: 15,
    dayOfWeek: 1,
    isRecurring: true,
  },
  {
    id: '2',
    disciplineId: '2',
    discipline: 'Pilates Mat',
    instructorId: '2',
    instructor: 'Ana Martínez',
    time: '08:00',
    duration: 55,
    maxCapacity: 12,
    dayOfWeek: 1,
    isRecurring: true,
  },
  {
    id: '3',
    disciplineId: '3',
    discipline: 'Pole Sport',
    instructorId: '3',
    instructor: 'Carolina López',
    time: '18:00',
    duration: 60,
    maxCapacity: 8,
    dayOfWeek: 3,
    isRecurring: true,
  },
]

const disciplineColors: Record<string, string> = {
  Yoga: 'bg-[#9CAF88]',
  'Pilates Mat': 'bg-[#C4A77D]',
  'Pole Sport': 'bg-[#D4A574]',
  'Sound Healing': 'bg-[#8B7355]',
}

export default function AdminHorariosPage() {
  const [classes, setClasses] = React.useState(initialClasses)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingClass, setEditingClass] = React.useState<typeof initialClasses[0] | null>(null)
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
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
    return classes
      .filter((cls) => cls.dayOfWeek === dayIndex)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  const handleCreate = (dayOfWeek?: number) => {
    setEditingClass(null)
    setSelectedDay(dayOfWeek ?? null)
    setIsModalOpen(true)
  }

  const handleEdit = (cls: typeof initialClasses[0]) => {
    setEditingClass(cls)
    setSelectedDay(null)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const disciplineId = formData.get('disciplineId') as string
    const instructorId = formData.get('instructorId') as string

    const data = {
      disciplineId,
      discipline: disciplines.find((d) => d.id === disciplineId)?.name || '',
      instructorId,
      instructor: instructors.find((i) => i.id === instructorId)?.name || '',
      time: formData.get('time') as string,
      duration: parseInt(formData.get('duration') as string),
      maxCapacity: parseInt(formData.get('maxCapacity') as string),
      dayOfWeek: parseInt(formData.get('dayOfWeek') as string),
      isRecurring: formData.get('isRecurring') === 'on',
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (editingClass) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === editingClass.id ? { ...c, ...data } : c
        )
      )
    } else {
      setClasses((prev) => [
        ...prev,
        { id: Date.now().toString(), ...data },
      ])
    }

    setIsLoading(false)
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar esta clase?')) {
      setClasses((prev) => prev.filter((c) => c.id !== id))
    }
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
            const dayClasses = getClassesForDay(date.getDay())
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
                      disciplineColors[cls.discipline]
                    )}
                    onClick={() => handleEdit(cls)}
                  >
                    <p className="font-medium">{cls.discipline}</p>
                    <p className="opacity-90">{cls.time}</p>
                    <p className="opacity-90">{cls.instructor.split(' ')[0]}</p>
                    <p className="opacity-90">{cls.maxCapacity} cupos</p>
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
                  name="disciplineId"
                  defaultValue={editingClass?.disciplineId}
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
                  name="instructorId"
                  defaultValue={editingClass?.instructorId}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Día de la semana
                </label>
                <Select
                  name="dayOfWeek"
                  defaultValue={
                    editingClass?.dayOfWeek?.toString() || selectedDay?.toString()
                  }
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isRecurring"
                  defaultChecked={editingClass?.isRecurring ?? true}
                  className="rounded border-beige-dark text-primary focus:ring-primary"
                />
                <span className="text-sm">Clase recurrente (cada semana)</span>
              </label>
            </div>

            <ModalFooter>
              {editingClass && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(editingClass.id)}
                  className="mr-auto text-[var(--color-error)]"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
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
    </div>
  )
}
