'use client'

import * as React from 'react'
import { Clock, Leaf } from 'lucide-react'

interface PackageStatus {
  classesRemaining: number
  classesTotal: number
  packageName: string
  expiryDate: string
  daysUntilExpiry: number
  isWarning: boolean
}

interface NextClassStatus {
  className: string
  classTime: string
  classDate: string
  instructor: string
}

interface DashboardStatus {
  package: PackageStatus | null
  nextClass: NextClassStatus | null
}

export function StatusCard() {
  const [data, setData] = React.useState<DashboardStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/user/dashboard-status')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching dashboard status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-beige-dark bg-gradient-to-r from-[#FFF8EF] to-[#F5F0E8] p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] rounded-full bg-beige-dark" />
            <div className="h-4 w-24 rounded bg-beige-dark" />
            <div className="h-3 w-20 rounded bg-beige-dark" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] rounded-full bg-beige-dark" />
            <div className="h-4 w-24 rounded bg-beige-dark" />
            <div className="h-3 w-20 rounded bg-beige-dark" />
          </div>
        </div>
      </div>
    )
  }

  const pkg = data?.package ?? null
  const nextClass = data?.nextClass ?? null

  return (
    <div className="rounded-2xl border border-beige-dark bg-gradient-to-r from-[#FFF8EF] to-[#F5F0E8] p-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Classes remaining */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-[50px] w-[50px] md:h-[60px] md:w-[60px] items-center justify-center rounded-full border-2 border-primary bg-white">
            {pkg ? (
              <span className="text-xl md:text-2xl font-semibold text-primary">
                {pkg.classesRemaining}
              </span>
            ) : (
              <Leaf className="h-5 w-5 md:h-6 md:w-6 text-primary/40" />
            )}
          </div>

          {pkg ? (
            <>
              <p className="text-sm md:text-base font-medium text-foreground leading-tight">
                {pkg.classesRemaining === 1 ? 'Clase restante' : 'Clases restantes'}
              </p>
              <p className="text-xs text-muted-foreground">{pkg.packageName}</p>
              <p
                className={`text-xs font-medium ${
                  pkg.isWarning ? 'text-[#D4A574]' : 'text-muted-foreground'
                }`}
              >
                Vence {pkg.expiryDate}
                {pkg.isWarning && ` (${pkg.daysUntilExpiry}d)`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Sin paquete activo</p>
              <p className="text-xs text-muted-foreground">
                Adquiere un paquete para reservar
              </p>
            </>
          )}
        </div>

        {/* Right: Next class */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-[50px] w-[50px] md:h-[60px] md:w-[60px] items-center justify-center rounded-full border-2 border-primary bg-white">
            {nextClass ? (
              <span className="text-xs md:text-sm font-semibold text-primary leading-tight">
                {nextClass.classTime}
              </span>
            ) : (
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-primary/40" />
            )}
          </div>

          {nextClass ? (
            <>
              <p className="text-sm md:text-base font-medium text-foreground leading-tight">
                {nextClass.className}
              </p>
              <p className="text-xs text-muted-foreground">{nextClass.classDate}</p>
              <p className="text-xs text-muted-foreground">
                con {nextClass.instructor}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">No hay clases reservadas</p>
              <p className="text-xs text-muted-foreground">
                Reserva tu siguiente clase
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
