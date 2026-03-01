import {
  DollarSign,
  Users,
  Calendar,
  Package,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, formatDate } from '@/lib/utils'
import { prisma } from '@/lib/prisma'

// El Salvador is UTC-6
const EL_SALVADOR_UTC_OFFSET = 6

function getElSalvadorTime(utcDate: Date): string {
  const esSv = new Date(utcDate.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  const hours = esSv.getUTCHours().toString().padStart(2, '0')
  const minutes = esSv.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

interface DashboardStats {
  monthlyRevenue: number
  totalUsers: number
  newUsersThisMonth: number
  todayReservations: number
  weekReservations: number
  activePackages: number
}

interface PopularClass {
  name: string
  count: number
}

interface RecentSale {
  id: string
  userName: string
  packageName: string
  amount: number
  date: Date
}

interface UpcomingClass {
  id: string
  disciplineName: string
  time: string
  instructorName: string
  enrolled: number
  capacity: number
}

async function getDashboardData() {
  const now = new Date()

  // Start of current month in El Salvador time → UTC
  const monthStartLocal = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, EL_SALVADOR_UTC_OFFSET, 0, 0))

  // Today in El Salvador time → UTC range
  const esSvNow = new Date(now.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  const todayStartUTC = new Date(Date.UTC(
    esSvNow.getUTCFullYear(), esSvNow.getUTCMonth(), esSvNow.getUTCDate(),
    EL_SALVADOR_UTC_OFFSET, 0, 0
  ))
  const todayEndUTC = new Date(Date.UTC(
    esSvNow.getUTCFullYear(), esSvNow.getUTCMonth(), esSvNow.getUTCDate() + 1,
    EL_SALVADOR_UTC_OFFSET - 1, 59, 59, 999
  ))

  // Start of current week (Monday) in El Salvador time
  const dayOfWeek = esSvNow.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStartUTC = new Date(Date.UTC(
    esSvNow.getUTCFullYear(), esSvNow.getUTCMonth(), esSvNow.getUTCDate() + mondayOffset,
    EL_SALVADOR_UTC_OFFSET, 0, 0
  ))

  // Run all queries in parallel
  const [
    monthlyRevenueResult,
    totalUsers,
    newUsersThisMonth,
    todayReservations,
    weekReservations,
    activePackages,
    popularClassesRaw,
    recentSalesRaw,
    todayClasses,
  ] = await Promise.all([
    // Monthly revenue from paid orders
    prisma.order.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: monthStartLocal },
      },
      _sum: { total: true },
    }),

    // Total users
    prisma.user.count(),

    // New users this month
    prisma.user.count({
      where: { createdAt: { gte: monthStartLocal } },
    }),

    // Today's reservations
    prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        class: {
          dateTime: { gte: todayStartUTC, lte: todayEndUTC },
        },
      },
    }),

    // This week's reservations
    prisma.reservation.count({
      where: {
        status: 'CONFIRMED',
        class: {
          dateTime: { gte: weekStartUTC, lte: todayEndUTC },
        },
      },
    }),

    // Active packages (purchases with remaining classes)
    prisma.purchase.count({
      where: {
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: now },
      },
    }),

    // Popular classes this month (by reservation count per discipline)
    prisma.reservation.groupBy({
      by: ['classId'],
      where: {
        status: { in: ['CONFIRMED', 'ATTENDED'] },
        createdAt: { gte: monthStartLocal },
      },
      _count: true,
      orderBy: { _count: { classId: 'desc' } },
      take: 20,
    }),

    // Recent sales (last 5 paid orders)
    prisma.order.findMany({
      where: { status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 5,
      include: {
        user: { select: { name: true } },
        items: {
          include: {
            package: { select: { name: true } },
          },
        },
      },
    }),

    // Today's classes
    prisma.class.findMany({
      where: {
        isCancelled: false,
        dateTime: { gte: todayStartUTC, lte: todayEndUTC },
      },
      include: {
        discipline: { select: { name: true } },
        instructor: { select: { name: true } },
        _count: {
          select: {
            reservations: { where: { status: 'CONFIRMED' } },
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    }),
  ])

  // Aggregate popular classes by discipline name
  const classIds = popularClassesRaw.map(r => r.classId)
  const classesWithDiscipline = classIds.length > 0
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, discipline: { select: { name: true } } },
      })
    : []

  const classIdToDiscipline = new Map(classesWithDiscipline.map(c => [c.id, c.discipline.name]))
  const disciplineCounts = new Map<string, number>()
  for (const r of popularClassesRaw) {
    const name = classIdToDiscipline.get(r.classId) || 'Desconocida'
    disciplineCounts.set(name, (disciplineCounts.get(name) || 0) + r._count)
  }
  const popularClasses: PopularClass[] = Array.from(disciplineCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }))

  // Format recent sales
  const recentSales: RecentSale[] = recentSalesRaw.map(order => ({
    id: order.id,
    userName: order.user.name,
    packageName: order.items.map(i => i.package.name).join(', ') || 'Paquete',
    amount: order.total,
    date: order.paidAt || order.createdAt,
  }))

  // Format today's classes
  const upcomingClasses: UpcomingClass[] = todayClasses.map(cls => ({
    id: cls.id,
    disciplineName: cls.discipline.name,
    time: getElSalvadorTime(cls.dateTime),
    instructorName: cls.instructor.name,
    enrolled: cls._count.reservations,
    capacity: cls.maxCapacity,
  }))

  const stats: DashboardStats = {
    monthlyRevenue: monthlyRevenueResult._sum.total || 0,
    totalUsers,
    newUsersThisMonth,
    todayReservations,
    weekReservations,
    activePackages,
  }

  return { stats, popularClasses, recentSales, upcomingClasses }
}

export default async function AdminDashboard() {
  const { stats, popularClasses, recentSales, upcomingClasses } = await getDashboardData()

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
                {stats.newUsersThisMonth > 0 && (
                  <p className="text-sm text-primary mt-1">
                    +{stats.newUsersThisMonth} este mes
                  </p>
                )}
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
            {popularClasses.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                No hay datos de reservas este mes
              </p>
            ) : (
              <div className="space-y-4">
                {popularClasses.map((cls) => (
                  <div key={cls.name} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{cls.name}</span>
                    <span className="text-gray-600">{cls.count} reservas</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                No hay ventas registradas
              </p>
            ) : (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{sale.userName}</p>
                      <p className="text-sm text-gray-500">{sale.packageName}</p>
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
            )}
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
          {upcomingClasses.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No hay clases programadas para hoy
            </p>
          ) : (
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
                        {cls.disciplineName}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{cls.time}</td>
                      <td className="py-3 px-4 text-gray-600">{cls.instructorName}</td>
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
          )}
        </CardContent>
      </Card>

    </div>
  )
}
