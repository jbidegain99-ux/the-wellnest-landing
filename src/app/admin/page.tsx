import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Package,
  Clock,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, formatDate } from '@/lib/utils'
import { SeedDatabaseButton } from '@/components/admin/SeedDatabaseButton'

// Mock data
const stats = {
  monthlyRevenue: 4850,
  revenueChange: 12,
  totalUsers: 156,
  usersChange: 8,
  todayReservations: 24,
  weekReservations: 89,
  activePackages: 78,
}

const popularClasses = [
  { name: 'Yoga', count: 45, trend: 'up' },
  { name: 'Pilates Mat', count: 38, trend: 'up' },
  { name: 'Terapia de Sonido', count: 28, trend: 'stable' },
  { name: 'Pole Fitness', count: 22, trend: 'down' },
]

const recentSales = [
  {
    id: '1',
    user: 'María López',
    package: '8 Clases',
    amount: 90,
    date: new Date(),
  },
  {
    id: '2',
    user: 'Ana García',
    package: 'Mensual Ilimitado',
    amount: 150,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    user: 'Laura Martínez',
    package: '4 Clases',
    amount: 50,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    user: 'Sofia Chen',
    package: '12 Clases',
    amount: 120,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]

const upcomingClasses = [
  {
    id: '1',
    name: 'Yoga',
    time: '06:00 AM',
    instructor: 'María García',
    enrolled: 12,
    capacity: 15,
  },
  {
    id: '2',
    name: 'Pilates Mat',
    time: '08:00 AM',
    instructor: 'Ana Martínez',
    enrolled: 12,
    capacity: 12,
  },
  {
    id: '3',
    name: 'Yoga',
    time: '10:00 AM',
    instructor: 'Laura Vega',
    enrolled: 8,
    capacity: 15,
  },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Dashboard
        </h1>
        <p className="text-gray-600 mt-1">
          Bienvenida al panel de administración
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ventas del mes</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  {formatPrice(stats.monthlyRevenue)}
                </p>
                <p className="text-sm text-primary mt-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />+{stats.revenueChange}%
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Usuarios totales</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  {stats.totalUsers}
                </p>
                <p className="text-sm text-primary mt-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />+{stats.usersChange} este mes
                </p>
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Users className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reservas hoy</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  {stats.todayReservations}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {stats.weekReservations} esta semana
                </p>
              </div>
              <div className="p-3 bg-[var(--color-success)]/10 rounded-full">
                <Calendar className="h-6 w-6 text-[var(--color-success)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paquetes activos</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  {stats.activePackages}
                </p>
                <p className="text-sm text-gray-500 mt-1">Con clases restantes</p>
              </div>
              <div className="p-3 bg-earthTone/10 rounded-full">
                <Package className="h-6 w-6 text-earthTone" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Clases más populares</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {popularClasses.map((cls) => (
                <div key={cls.name} className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{cls.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{cls.count} reservas</span>
                    <Badge
                      variant={
                        cls.trend === 'up'
                          ? 'success'
                          : cls.trend === 'down'
                          ? 'error'
                          : 'default'
                      }
                    >
                      {cls.trend === 'up' ? '↑' : cls.trend === 'down' ? '↓' : '→'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{sale.user}</p>
                    <p className="text-sm text-gray-500">{sale.package}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {formatPrice(sale.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(sale.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clases de hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Clase
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Hora
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Instructor
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Inscritos
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {upcomingClasses.map((cls) => (
                  <tr key={cls.id}>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {cls.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{cls.time}</td>
                    <td className="py-3 px-4 text-gray-600">{cls.instructor}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {cls.enrolled}/{cls.capacity}
                    </td>
                    <td className="py-3 px-4">
                      {cls.enrolled >= cls.capacity ? (
                        <Badge variant="error">Lleno</Badge>
                      ) : cls.enrolled >= cls.capacity * 0.8 ? (
                        <Badge variant="warning">Casi lleno</Badge>
                      ) : (
                        <Badge variant="success">Disponible</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Admin Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Herramientas de Administración
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <p className="text-sm text-gray-600 mb-4">
              Reinicializa la base de datos con los datos por defecto (disciplinas, instructores, paquetes y clases).
            </p>
            <SeedDatabaseButton />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
