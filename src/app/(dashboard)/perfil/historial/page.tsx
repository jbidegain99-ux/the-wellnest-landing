'use client'

import * as React from 'react'
import { Check, X, TrendingUp, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { formatDate, formatTime } from '@/lib/utils'

interface HistoryEntry {
  id: string
  status: string
  checkedIn: boolean
  className: string
  disciplineSlug: string
  instructor: string
  dateTime: string
  duration: number
}

interface HistoryStats {
  totalClasses: number
  thisMonth: number
  streak: number
  favoriteDiscipline: string
  classesPerDiscipline: Record<string, number>
}

export default function HistorialPage() {
  const [filter, setFilter] = React.useState('all')
  const [history, setHistory] = React.useState<HistoryEntry[]>([])
  const [stats, setStats] = React.useState<HistoryStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/user/history')
        if (response.ok) {
          const data = await response.json()
          setHistory(data.reservations)
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchHistory()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const filteredHistory = filter === 'all'
    ? history
    : history.filter(entry => entry.disciplineSlug === filter)

  // Get unique disciplines for filter dropdown
  const disciplines = Array.from(
    new Map(history.map(h => [h.disciplineSlug, h.className])).entries()
  )

  const totalForBars = stats?.totalClasses || 1

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Historial de Clases
        </h1>
        <p className="text-gray-600 mt-1">
          Tu registro completo de asistencias
        </p>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Aún no tienes clases en tu historial. Reserva una clase para comenzar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-serif font-semibold text-primary">
                    {stats.totalClasses}
                  </p>
                  <p className="text-sm text-gray-600">Clases tomadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-serif font-semibold text-primary">
                    {stats.thisMonth}
                  </p>
                  <p className="text-sm text-gray-600">Este mes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    <p className="text-3xl font-serif font-semibold text-primary">
                      {stats.streak}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">Semanas seguidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-serif font-semibold text-primary">
                    {stats.favoriteDiscipline}
                  </p>
                  <p className="text-sm text-gray-600">Favorita</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Discipline breakdown */}
          {stats && Object.keys(stats.classesPerDiscipline).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Clases por Disciplina</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.classesPerDiscipline)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => (
                      <div key={name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{name}</span>
                          <span className="font-medium">{count} clases</span>
                        </div>
                        <div className="h-2 bg-beige rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${(count / totalForBars) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* History list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Registro de Asistencias
              </h2>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {disciplines.map(([slug, name]) => (
                    <SelectItem key={slug} value={slug}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-beige">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        Clase
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        Fecha
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        Hora
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        Instructor
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-beige">
                    {filteredHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {entry.className}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(new Date(entry.dateTime))}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatTime(new Date(entry.dateTime))}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {entry.instructor}
                        </td>
                        <td className="py-3 px-4">
                          {entry.status === 'ATTENDED' || entry.checkedIn ? (
                            <Badge variant="success" className="gap-1">
                              <Check className="h-3 w-3" />
                              Asistio
                            </Badge>
                          ) : entry.status === 'CANCELLED' ? (
                            <Badge variant="secondary" className="gap-1">
                              Cancelada
                            </Badge>
                          ) : (
                            <Badge variant="error" className="gap-1">
                              <X className="h-3 w-3" />
                              No asistio
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-beige">
                {filteredHistory.map((entry) => (
                  <div key={entry.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{entry.className}</span>
                      {entry.status === 'ATTENDED' || entry.checkedIn ? (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" />
                          Asistio
                        </Badge>
                      ) : entry.status === 'CANCELLED' ? (
                        <Badge variant="secondary">Cancelada</Badge>
                      ) : (
                        <Badge variant="error" className="gap-1">
                          <X className="h-3 w-3" />
                          No asistio
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(new Date(entry.dateTime))} — {formatTime(new Date(entry.dateTime))}
                    </p>
                    <p className="text-sm text-gray-500">{entry.instructor}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
