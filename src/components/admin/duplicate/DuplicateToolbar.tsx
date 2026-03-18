'use client'

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { X, ChevronRight } from 'lucide-react'

interface DuplicateToolbarProps {
  selectedCount: number
  weekDates: Date[]
  weekDays: string[]
  onSelectDay: (dayOfWeek: number) => void
  onSelectAll: () => void
  onCancel: () => void
  onNext: () => void
}

export default function DuplicateToolbar({
  selectedCount,
  weekDates,
  weekDays,
  onSelectDay,
  onSelectAll,
  onCancel,
  onNext,
}: DuplicateToolbarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-beige shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full">
            {selectedCount} {selectedCount === 1 ? 'clase' : 'clases'}
          </span>

          <select
            className="text-sm border border-beige rounded-lg px-2 py-1.5"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onSelectDay(parseInt(e.target.value))
                e.target.value = ''
              }
            }}
          >
            <option value="" disabled>Seleccionar día...</option>
            {weekDates.map((date, i) => (
              <option key={i} value={date.getDay()}>
                {weekDays[date.getDay()]} {date.getDate()}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onSelectAll}
            className="text-sm text-primary hover:underline"
          >
            Toda la semana
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button size="sm" onClick={onNext} disabled={selectedCount === 0}>
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
