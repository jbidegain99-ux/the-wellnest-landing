import type { MonthStat } from '@/lib/progress/summary'
import { monthFullName, monthShortName, plural } from '@/lib/progress/display'

interface MonthBarsProps {
  months: MonthStat[]
}

const BAR_MAX_PX = 112

/** Barras de clases por mes; cada barra lleva su número visible. */
export function MonthBars({ months }: MonthBarsProps) {
  const max = Math.max(1, ...months.map((m) => m.classes))

  return (
    <ul className="grid grid-cols-6 gap-2 sm:gap-4 items-end">
      {months.map((m, i) => {
        const isCurrent = i === months.length - 1
        const height = m.classes > 0 ? Math.max(6, Math.round((m.classes / max) * BAR_MAX_PX)) : 2
        return (
          <li key={m.label} className="flex flex-col items-center gap-1 text-center">
            <span className="sr-only">
              {monthFullName(m.label)}: {plural(m.classes, 'clase', 'clases')}, {m.minutes} min
            </span>
            <span className="text-sm font-semibold text-foreground" aria-hidden="true">
              {m.classes}
            </span>
            <div className="flex items-end w-full justify-center" style={{ height: BAR_MAX_PX }} aria-hidden="true">
              <div
                className={
                  'w-full max-w-[36px] rounded-t-lg ' +
                  (isCurrent ? 'bg-primary-600' : m.classes > 0 ? 'bg-primary' : 'bg-beige-dark')
                }
                style={{ height }}
              />
            </div>
            <span
              className={'text-xs ' + (isCurrent ? 'font-semibold text-foreground' : 'text-gray-600')}
              aria-hidden="true"
            >
              {monthShortName(m.label)}
            </span>
            <span className="text-[11px] text-gray-500 whitespace-nowrap" aria-hidden="true">
              {m.minutes} min
            </span>
          </li>
        )
      })}
    </ul>
  )
}
