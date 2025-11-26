'use client'

import * as React from 'react'
import { Calendar, Clock, User, Check, X, TrendingUp } from 'lucide-react'
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

// Mock data
const classHistory = [
  {
    id: '1',
    className: 'Yoga',
    instructor: 'María García',
    dateTime: new Date('2024-01-10T06:00:00'),
    duration: 60,
    status: 'ATTENDED',
  },
  {
    id: '2',
    className: 'Pilates Mat',
    instructor: 'Ana Martínez',
    dateTime: new Date('2024-01-08T08:00:00'),
    duration: 55,
    status: 'ATTENDED',
  },
  {
    id: '3',
    className: 'Yoga',
    instructor: 'Laura Vega',
    dateTime: new Date('2024-01-05T10:00:00'),
    duration: 75,
    status: 'ATTENDED',
  },
  {
    id: '4',
    className: 'Sound Healing',
    instructor: 'Sofía Hernández',
    dateTime: new Date('2024-01-03T19:30:00'),
    duration: 90,
    status: 'ATTENDED',
  },
  {
    id: '5',
    className: 'Pole Sport',
    instructor: 'Carolina López',
    dateTime: new Date('2024-01-01T18:00:00'),
    duration: 60,
    status: 'NO_SHOW',
  },
  {
    id: '6',
    className: 'Yoga',
    instructor: 'María García',
    dateTime: new Date('2023-12-28T06:00:00'),
    duration: 60,
    status: 'ATTENDED',
  },
]

const stats = {
  totalClasses: 24,
  thisMonth: 8,
  streak: 3,
  favoriteDiscipline: 'Yoga',
  classesPerDiscipline: {
    Yoga: 12,
    'Pilates Mat': 6,
    'Sound Healing': 4,
    'Pole Sport': 2,
  },
}

export default function HistorialPage() {
  const [filter, setFilter] = React.useState('all')

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

      {/* Stats */}
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

      {/* Discipline breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Clases por Disciplina</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.classesPerDiscipline).map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{name}</span>
                  <span className="font-medium">{count} clases</span>
                </div>
                <div className="h-2 bg-beige rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${(count / stats.totalClasses) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <SelectItem value="yoga">Yoga</SelectItem>
              <SelectItem value="pilates">Pilates Mat</SelectItem>
              <SelectItem value="pole">Pole Sport</SelectItem>
              <SelectItem value="soundhealing">Sound Healing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <div className="overflow-x-auto">
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
                {classHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {entry.className}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(entry.dateTime)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatTime(entry.dateTime)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {entry.instructor}
                    </td>
                    <td className="py-3 px-4">
                      {entry.status === 'ATTENDED' ? (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" />
                          Asistió
                        </Badge>
                      ) : (
                        <Badge variant="error" className="gap-1">
                          <X className="h-3 w-3" />
                          No asistió
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
