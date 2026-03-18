'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatWeekRange, addDaysToDateStr } from './utils'

interface WeekPickerProps {
  value: string // Monday YYYY-MM-DD
  onChange: (monday: string) => void
  minDate?: string // YYYY-MM-DD
}

export default function WeekPicker({ value, onChange, minDate }: WeekPickerProps) {
  const canGoPrev = !minDate || value > minDate

  const goPrev = () => {
    if (!canGoPrev) return
    onChange(addDaysToDateStr(value, -7))
  }

  const goNext = () => {
    onChange(addDaysToDateStr(value, 7))
  }

  // Snap a date input value to its Monday
  const handleDateJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    if (!dateStr) return
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day
    date.setDate(date.getDate() + diff)
    const monday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onChange(monday)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoPrev}
        className="p-1.5 rounded-full hover:bg-beige transition-colors disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium min-w-[200px] text-center">
        {formatWeekRange(value)}
      </span>
      <button
        type="button"
        onClick={goNext}
        className="p-1.5 rounded-full hover:bg-beige transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <input
        type="date"
        className="text-xs border border-beige rounded px-2 py-1 ml-2"
        onChange={handleDateJump}
        min={minDate}
      />
    </div>
  )
}
