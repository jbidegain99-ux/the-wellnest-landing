'use client'

import * as React from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import type { DuplicateClassEntry, ConflictInfo } from './types'
import { formatDateShort } from './utils'
import WeekPicker from './WeekPicker'

interface Instructor {
  id: string
  name: string
}

interface DuplicateConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: DuplicateClassEntry[]
  conflicts: ConflictInfo[]
  duplicateMode: 'single-date' | 'maintain-structure'
  onModeChange: (mode: 'single-date' | 'maintain-structure') => void
  targetWeekStart: string
  onTargetWeekChange: (monday: string) => void
  targetDate: string
  onTargetDateChange: (date: string) => void
  sourceWeekMonday: string
  instructors: Instructor[]
  onUpdateEntry: (index: number, field: keyof DuplicateClassEntry, value: string | number | null) => void
  onSubmit: () => void
  isSubmitting: boolean
  selectionSpansMultipleDays: boolean
}

export default function DuplicateConfigModal({
  open,
  onOpenChange,
  entries,
  conflicts,
  duplicateMode,
  onModeChange,
  targetWeekStart,
  onTargetWeekChange,
  targetDate,
  onTargetDateChange,
  sourceWeekMonday,
  instructors,
  onUpdateEntry,
  onSubmit,
  isSubmitting,
  selectionSpansMultipleDays,
}: DuplicateConfigModalProps) {
  const conflictIndices = new Set(conflicts.map(c => c.entryIndex))
  const conflictMap = new Map(conflicts.map(c => [c.entryIndex, c.reason]))

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>Duplicar Clases</ModalTitle>
        </ModalHeader>

        <div className="space-y-5 py-4">
          {/* Mode selector - only show if selection spans multiple days */}
          {selectionSpansMultipleDays && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Modo de duplicación</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onModeChange('maintain-structure')}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    duplicateMode === 'maintain-structure'
                      ? 'border-primary bg-primary/5'
                      : 'border-beige hover:border-beige-dark'
                  )}
                >
                  <p className="font-medium text-sm">Mantener estructura semanal</p>
                  <p className="text-xs text-gray-500 mt-0.5">Lun → Lun, Mar → Mar, etc.</p>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('single-date')}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    duplicateMode === 'single-date'
                      ? 'border-primary bg-primary/5'
                      : 'border-beige hover:border-beige-dark'
                  )}
                >
                  <p className="font-medium text-sm">Una fecha destino</p>
                  <p className="text-xs text-gray-500 mt-0.5">Todas las clases al mismo día</p>
                </button>
              </div>
            </div>
          )}

          {/* Target picker */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {duplicateMode === 'maintain-structure' ? 'Semana destino' : 'Fecha destino'}
            </label>
            {duplicateMode === 'maintain-structure' ? (
              <WeekPicker
                value={targetWeekStart}
                onChange={onTargetWeekChange}
                minDate={sourceWeekMonday}
              />
            ) : (
              <input
                type="date"
                value={targetDate}
                onChange={(e) => onTargetDateChange(e.target.value)}
                className="border border-beige rounded-lg px-3 py-2 text-sm w-full"
              />
            )}
          </div>

          {/* Preview table */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Vista previa ({entries.length} {entries.length === 1 ? 'clase' : 'clases'})
            </label>
            <div className="border border-beige rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[100px_80px_1fr_1fr_70px] gap-2 px-3 py-2 bg-beige/50 text-xs font-medium text-gray-500">
                <span>Fecha</span>
                <span>Hora</span>
                <span>Disciplina</span>
                <span>Instructor</span>
                <span>Cap.</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-beige max-h-[300px] overflow-y-auto">
                {entries.map((entry, index) => {
                  const hasConflict = conflictIndices.has(index)
                  return (
                    <div
                      key={index}
                      className={cn(
                        'grid grid-cols-[100px_80px_1fr_1fr_70px] gap-2 px-3 py-2 items-center text-sm',
                        hasConflict && 'border-l-4 border-l-red-400 bg-red-50'
                      )}
                    >
                      <span className="text-xs">{formatDateShort(entry.targetDate)}</span>
                      <input
                        type="time"
                        value={entry.targetTime}
                        onChange={(e) => onUpdateEntry(index, 'targetTime', e.target.value)}
                        className="border border-beige rounded px-1 py-0.5 text-xs w-full"
                      />
                      <span className="text-xs truncate" title={entry.sourceDiscipline}>
                        {entry.sourceDiscipline}
                        {entry.sourceComplementaryDiscipline && ` + ${entry.sourceComplementaryDiscipline}`}
                      </span>
                      <select
                        value={entry.instructorId}
                        onChange={(e) => onUpdateEntry(index, 'instructorId', e.target.value)}
                        className="border border-beige rounded px-1 py-0.5 text-xs w-full"
                      >
                        {instructors.map(inst => (
                          <option key={inst.id} value={inst.id}>{inst.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={entry.maxCapacity}
                        onChange={(e) => onUpdateEntry(index, 'maxCapacity', parseInt(e.target.value) || 1)}
                        className="border border-beige rounded px-1 py-0.5 text-xs w-full"
                      />
                      {hasConflict && (
                        <p className="col-span-5 text-xs text-red-500 flex items-center gap-1 -mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {conflictMap.get(index)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <ModalFooter>
          {conflicts.length > 0 && (
            <span className="text-xs text-red-500 mr-auto flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {conflicts.length} conflicto(s) detectado(s)
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || entries.length === 0}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Creando...' : `Crear ${entries.length} clase${entries.length === 1 ? '' : 's'}`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
