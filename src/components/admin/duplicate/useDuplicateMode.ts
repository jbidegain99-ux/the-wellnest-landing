'use client'

import * as React from 'react'
import type { DuplicateClassEntry, ConflictInfo, DuplicateApiResponse } from './types'
import { buildEntriesFromSelection, detectConflicts, addDaysToDateStr, getElSalvadorDateStr, getMondayOfWeek } from './utils'

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

interface UseDuplicateModeParams {
  classes: ClassItem[]
  currentWeekStart: Date
  showSuccess: (msg: string) => void
  showError: (msg: string) => void
  fetchClasses: () => Promise<void>
  setCurrentWeekStart: (date: Date) => void
}

export function useDuplicateMode({
  classes,
  currentWeekStart,
  showSuccess,
  showError,
  fetchClasses,
  setCurrentWeekStart,
}: UseDuplicateModeParams) {
  const [isDuplicateMode, setIsDuplicateMode] = React.useState(false)
  const [selectedClassIds, setSelectedClassIds] = React.useState<Set<string>>(new Set())
  const [step, setStep] = React.useState<'select' | 'configure'>('select')
  const [duplicateMode, setDuplicateMode] = React.useState<'single-date' | 'maintain-structure'>('maintain-structure')
  const [targetWeekStart, setTargetWeekStart] = React.useState('')
  const [targetDate, setTargetDate] = React.useState('')
  const [entries, setEntries] = React.useState<DuplicateClassEntry[]>([])
  const [conflicts, setConflicts] = React.useState<ConflictInfo[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Source week Monday as YYYY-MM-DD
  const sourceWeekMonday = React.useMemo(() => {
    const d = currentWeekStart
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [currentWeekStart])

  // Default target week = next week
  const defaultTargetWeek = React.useMemo(() => addDaysToDateStr(sourceWeekMonday, 7), [sourceWeekMonday])

  // Check if selection spans multiple days
  const selectionSpansMultipleDays = React.useMemo(() => {
    const selectedClasses = classes.filter(c => selectedClassIds.has(c.id))
    const dates = new Set(selectedClasses.map(c => getElSalvadorDateStr(c.dateTime)))
    return dates.size > 1
  }, [classes, selectedClassIds])

  const enterDuplicateMode = () => {
    setIsDuplicateMode(true)
    setSelectedClassIds(new Set())
    setStep('select')
  }

  const exitDuplicateMode = () => {
    setIsDuplicateMode(false)
    setSelectedClassIds(new Set())
    setStep('select')
    setEntries([])
    setConflicts([])
  }

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  const selectAllForDay = (dayOfWeek: number) => {
    const eligibleClasses = classes.filter(c => {
      if (c.isCancelled) return false
      const svDate = getElSalvadorDateStr(c.dateTime)
      const [y, m, d] = svDate.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return date.getDay() === dayOfWeek
    })

    setSelectedClassIds(prev => {
      const next = new Set(prev)
      // If all are already selected, deselect them
      const allSelected = eligibleClasses.every(c => next.has(c.id))
      if (allSelected) {
        eligibleClasses.forEach(c => next.delete(c.id))
      } else {
        eligibleClasses.forEach(c => next.add(c.id))
      }
      return next
    })
  }

  const selectAllWeek = () => {
    const eligible = classes.filter(c => !c.isCancelled)
    const allSelected = eligible.every(c => selectedClassIds.has(c.id))
    if (allSelected) {
      setSelectedClassIds(new Set())
    } else {
      setSelectedClassIds(new Set(eligible.map(c => c.id)))
    }
  }

  const proceedToConfig = () => {
    const mode = selectionSpansMultipleDays ? duplicateMode : 'single-date'
    if (!selectionSpansMultipleDays) {
      setDuplicateMode('single-date')
    }

    const tw = targetWeekStart || defaultTargetWeek
    setTargetWeekStart(tw)

    const td = targetDate || addDaysToDateStr(sourceWeekMonday, 7)
    setTargetDate(td)

    const selectedClasses = classes.filter(c => selectedClassIds.has(c.id))
    const target = mode === 'maintain-structure' ? tw : td
    const built = buildEntriesFromSelection(selectedClasses, mode, target)
    setEntries(built)
    setConflicts(detectConflicts(built))
    setStep('configure')
  }

  // Rebuild entries when mode or target changes
  const rebuildEntries = React.useCallback((mode: 'single-date' | 'maintain-structure', tw: string, td: string) => {
    const selectedClasses = classes.filter(c => selectedClassIds.has(c.id))
    if (selectedClasses.length === 0) return
    const target = mode === 'maintain-structure' ? tw : td
    const built = buildEntriesFromSelection(selectedClasses, mode, target)
    setEntries(built)
    setConflicts(detectConflicts(built))
  }, [classes, selectedClassIds])

  const handleModeChange = (mode: 'single-date' | 'maintain-structure') => {
    setDuplicateMode(mode)
    const tw = targetWeekStart || defaultTargetWeek
    const td = targetDate || addDaysToDateStr(sourceWeekMonday, 7)
    rebuildEntries(mode, tw, td)
  }

  const handleTargetWeekChange = (monday: string) => {
    setTargetWeekStart(monday)
    rebuildEntries(duplicateMode, monday, targetDate)
  }

  const handleTargetDateChange = (date: string) => {
    setTargetDate(date)
    rebuildEntries(duplicateMode, targetWeekStart, date)
  }

  const updateEntry = (index: number, field: keyof DuplicateClassEntry, value: string | number | null) => {
    setEntries(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      const newConflicts = detectConflicts(next)
      setConflicts(newConflicts)
      return next
    })
  }

  const submit = async () => {
    if (entries.length === 0) return
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/classes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classes: entries.map(e => ({
            sourceClassId: e.sourceClassId,
            targetDate: e.targetDate,
            targetTime: e.targetTime,
            instructorId: e.instructorId,
            disciplineId: e.disciplineId,
            complementaryDisciplineId: e.complementaryDisciplineId,
            duration: e.duration,
            maxCapacity: e.maxCapacity,
            classType: e.classType,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        showError(data.error || 'Error al duplicar clases')
        return
      }

      const result: DuplicateApiResponse = await response.json()

      if (result.created > 0) {
        // Navigate to the target week
        if (duplicateMode === 'maintain-structure' && targetWeekStart) {
          const [y, m, d] = targetWeekStart.split('-').map(Number)
          setCurrentWeekStart(new Date(y, m - 1, d))
        } else if (entries.length > 0) {
          const firstTargetDate = entries[0].targetDate
          const monday = getMondayOfWeek(firstTargetDate)
          const [y, m, d] = monday.split('-').map(Number)
          setCurrentWeekStart(new Date(y, m - 1, d))
        }
      }

      // Refresh after navigation
      await fetchClasses()

      if (result.failed > 0) {
        showError(`Se crearon ${result.created} clase(s), pero ${result.failed} fallaron`)
      } else {
        showSuccess(`Se crearon ${result.created} clase(s) correctamente`)
      }

      exitDuplicateMode()
    } catch (error) {
      console.error('Error duplicating classes:', error)
      showError('Error de conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isDuplicateMode,
    selectedClassIds,
    step,
    duplicateMode,
    targetWeekStart,
    targetDate,
    entries,
    conflicts,
    isSubmitting,
    sourceWeekMonday,
    selectionSpansMultipleDays,
    enterDuplicateMode,
    exitDuplicateMode,
    toggleClass,
    selectAllForDay,
    selectAllWeek,
    proceedToConfig,
    handleModeChange,
    handleTargetWeekChange,
    handleTargetDateChange,
    updateEntry,
    submit,
  }
}
