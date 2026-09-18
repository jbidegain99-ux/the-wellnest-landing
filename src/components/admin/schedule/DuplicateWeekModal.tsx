'use client'

import * as React from 'react'
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { addDaysToDateStr, formatDateShort, getTodaySV } from '@/lib/schedule/classDates'
import {
  buildDuplicateEntries,
  detectBatchConflicts,
  getMondayOfWeek,
  type DuplicateEntry,
  type DuplicateMode,
  type DuplicateSource,
} from '@/lib/schedule/duplicateWeek'

interface InstructorOption {
  id: string
  name: string
}

export interface DuplicateResult {
  message: string
  skipped: Array<{ label: string; reason: string }>
  /** Lunes de la semana donde quedaron las clases, para navegar hacia ella. */
  targetMonday: string
}

interface DuplicateWeekModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Clases seleccionadas; todas de la semana `sourceMonday`. */
  sources: DuplicateSource[]
  sourceMonday: string
  instructors: InstructorOption[]
  onSuccess: (result: DuplicateResult) => void
  onError: (message: string) => void
}

type EditableField = 'targetTime' | 'instructorId' | 'maxCapacity'

export default function DuplicateWeekModal({
  open,
  onOpenChange,
  sources,
  sourceMonday,
  instructors,
  onSuccess,
  onError,
}: DuplicateWeekModalProps) {
  const today = getTodaySV()
  // No se duplica hacia semanas pasadas ni hacia la misma semana de origen.
  const minTargetMonday = React.useMemo(() => {
    const todayMonday = getMondayOfWeek(today)
    const afterSource = addDaysToDateStr(sourceMonday, 7)
    return afterSource > todayMonday ? afterSource : todayMonday
  }, [today, sourceMonday])

  const [mode, setMode] = React.useState<DuplicateMode>('week')
  const [targetMonday, setTargetMonday] = React.useState(minTargetMonday)
  const [targetDate, setTargetDate] = React.useState(minTargetMonday)
  const [entries, setEntries] = React.useState<DuplicateEntry[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Al abrir, arranca en la semana siguiente con lo seleccionado.
  React.useEffect(() => {
    if (!open) return
    setMode('week')
    setTargetMonday(minTargetMonday)
    setTargetDate(minTargetMonday)
    setEntries(buildDuplicateEntries(sources, 'week', minTargetMonday))
  }, [open, sources, minTargetMonday])

  const rebuild = (nextMode: DuplicateMode, target: string) => {
    setEntries(buildDuplicateEntries(sources, nextMode, target))
  }

  const changeMode = (nextMode: DuplicateMode) => {
    setMode(nextMode)
    rebuild(nextMode, nextMode === 'week' ? targetMonday : targetDate)
  }

  const changeWeek = (monday: string) => {
    if (monday < minTargetMonday) return
    setTargetMonday(monday)
    rebuild('week', monday)
  }

  const changeDate = (date: string) => {
    if (!date) return
    setTargetDate(date)
    rebuild('date', date)
  }

  const updateEntry = (index: number, field: EditableField, value: string | number) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)))
  }

  const conflicts = detectBatchConflicts(entries)
  const pastCount = entries.filter((e) => e.targetDate < today).length

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/classes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classes: entries.map((e) => ({
            sourceClassId: e.sourceClassId,
            targetDate: e.targetDate,
            targetTime: e.targetTime,
            instructorId: e.instructorId,
            duration: e.duration,
            maxCapacity: e.maxCapacity,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        onError(data.error || 'Error al duplicar clases')
        return
      }
      onSuccess({
        message: data.message,
        skipped: data.skipped || [],
        targetMonday: mode === 'week' ? targetMonday : getMondayOfWeek(targetDate),
      })
    } catch (error) {
      console.error('Error duplicating classes:', error)
      onError('Error de conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  const count = entries.length

  return (
    <Modal open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <ModalContent className="max-w-3xl flex flex-col overflow-hidden p-0 gap-0">
        <ModalHeader className="shrink-0 px-4 sm:px-6 pt-6 pb-3">
          <ModalTitle>Duplicar clases</ModalTitle>
          <p className="text-sm text-gray-500">
            Semana de origen: {formatDateShort(sourceMonday)} — {formatDateShort(addDaysToDateStr(sourceMonday, 6))}
          </p>
        </ModalHeader>

        <div className="space-y-5 px-4 sm:px-6 py-2 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => changeMode('week')}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all',
                mode === 'week' ? 'border-primary bg-primary/5' : 'border-beige hover:border-beige-dark'
              )}
            >
              <p className="font-medium text-sm">A otra semana</p>
              <p className="text-xs text-gray-500 mt-0.5">Lun → Lun, Mar → Mar…</p>
            </button>
            <button
              type="button"
              onClick={() => changeMode('date')}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all',
                mode === 'date' ? 'border-primary bg-primary/5' : 'border-beige hover:border-beige-dark'
              )}
            >
              <p className="font-medium text-sm">A un solo día</p>
              <p className="text-xs text-gray-500 mt-0.5">Todas al mismo día</p>
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {mode === 'week' ? 'Semana destino' : 'Fecha destino'}
            </label>
            {mode === 'week' ? (
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => changeWeek(addDaysToDateStr(targetMonday, -7))}
                  disabled={targetMonday <= minTargetMonday}
                  className="p-1.5 rounded-full hover:bg-beige transition-colors disabled:opacity-30"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium sm:min-w-[200px] text-center">
                  {formatDateShort(targetMonday)} — {formatDateShort(addDaysToDateStr(targetMonday, 6))}
                </span>
                <button
                  type="button"
                  onClick={() => changeWeek(addDaysToDateStr(targetMonday, 7))}
                  className="p-1.5 rounded-full hover:bg-beige transition-colors"
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <input
                type="date"
                value={targetDate}
                min={today}
                onChange={(e) => changeDate(e.target.value)}
                className="border border-beige rounded-lg px-3 py-2 text-base sm:text-sm w-full"
              />
            )}
            <p className="text-xs text-gray-500">
              Solo se duplica hacia una semana. Para otra semana, vuelve a duplicar.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Vista previa ({count} {count === 1 ? 'clase' : 'clases'})
            </p>
            <div className="border border-beige rounded-xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[110px_90px_1fr_1fr_70px] gap-2 px-3 py-2 bg-beige/50 text-xs font-medium text-gray-500">
                <span>Fecha</span>
                <span>Hora</span>
                <span>Disciplina</span>
                <span>Instructor</span>
                <span>Cupo</span>
              </div>
              <div className="divide-y divide-beige">
                {entries.map((entry, index) => {
                  const conflict = conflicts.get(index)
                  const isPast = entry.targetDate < today
                  return (
                    <div
                      key={entry.sourceClassId}
                      className={cn(
                        'grid grid-cols-2 sm:grid-cols-[110px_90px_1fr_1fr_70px] gap-2 px-3 py-2 items-center text-sm',
                        (conflict || isPast) && 'border-l-4 border-l-red-400 bg-red-50'
                      )}
                    >
                      <span className="text-xs font-medium">{formatDateShort(entry.targetDate)}</span>
                      <input
                        type="time"
                        value={entry.targetTime}
                        onChange={(e) => updateEntry(index, 'targetTime', e.target.value)}
                        className="border border-beige rounded px-1 py-0.5 text-base sm:text-xs w-full"
                        aria-label="Hora"
                      />
                      <span className="text-xs truncate col-span-2 sm:col-span-1">
                        {entry.discipline}
                        {entry.complementaryDiscipline && ` + ${entry.complementaryDiscipline}`}
                      </span>
                      <select
                        value={entry.instructorId}
                        onChange={(e) => updateEntry(index, 'instructorId', e.target.value)}
                        className="border border-beige rounded px-1 py-0.5 text-base sm:text-xs w-full"
                        aria-label="Instructor"
                      >
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={entry.maxCapacity}
                        onChange={(e) => updateEntry(index, 'maxCapacity', parseInt(e.target.value) || 1)}
                        className="border border-beige rounded px-1 py-0.5 text-base sm:text-xs w-full"
                        aria-label="Cupo"
                      />
                      {(conflict || isPast) && (
                        <p className="col-span-2 sm:col-span-5 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {isPast ? 'La fecha ya pasó; se omitirá' : conflict}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <ModalFooter className="shrink-0 border-t border-beige px-4 sm:px-6 py-4 gap-2">
          {conflicts.size > 0 && (
            <span className="text-xs text-red-500 sm:mr-auto flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {conflicts.size} conflicto(s) en el lote
            </span>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            isLoading={isSubmitting}
            disabled={count === 0 || conflicts.size > 0 || pastCount === count}
          >
            {`Crear ${count - pastCount} ${count - pastCount === 1 ? 'clase' : 'clases'}`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
