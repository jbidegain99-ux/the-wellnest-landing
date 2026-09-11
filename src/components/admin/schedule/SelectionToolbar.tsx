'use client'

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { X, Trash2 } from 'lucide-react'

interface SelectionToolbarProps {
  selectedCount: number
  weekDates: Date[]
  weekDays: string[]
  onSelectDay: (dayOfWeek: number) => void
  onSelectAll: () => void
  onCancel: () => void
  onDelete: () => void
}

export default function SelectionToolbar({
  selectedCount,
  weekDates,
  weekDays,
  onSelectDay,
  onSelectAll,
  onCancel,
  onDelete,
}: SelectionToolbarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-beige shadow-lg">
      {/* En móvil se apila: los controles de selección arriba, las acciones abajo. */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="inline-flex shrink-0 items-center bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full">
            {selectedCount} {selectedCount === 1 ? 'clase' : 'clases'}
          </span>

          <select
            className="text-sm border border-beige rounded-lg px-2 py-1.5 min-w-0 flex-1 sm:flex-none"
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
            className="text-sm text-primary hover:underline whitespace-nowrap shrink-0"
          >
            Toda la semana
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1 sm:flex-none">
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
