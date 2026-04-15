import React from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Landmark,
  Receipt,
  CreditCard,
  ArrowDownRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { EXCLUDED_USER_IDS } from '@/lib/constants'
import { getExcludedPurchaseIds } from '@/lib/excluded-purchases'
import {
  getStartOfMonthSV,
  getStartOfWeekSV,
  getStartOfTodaySV,
} from '@/lib/utils/timezone'
import {
  aggregatePurchases,
  groupByDaySV,
  type RawPurchase,
} from '@/lib/finance/aggregate'
import { classifyPayment, type PaymentMethod } from '@/lib/finance/calculate'
import { getCurrentFinancialConfig } from '@/lib/finance/config'
import { formatInTimeZone } from 'date-fns-tz'

const TZ = 'America/El_Salvador'

type DetailRow = {
  id: string
  userName: string
  userEmail: string
  method: PaymentMethod
  amount: number
  packageName: string
  disciplines: string[]
  createdAt: Date
}

type DisciplineStats = {
  name: string
  revenue: number
  orders: number
  customers: number
}

const DETAIL_METHODS: ReadonlyArray<PaymentMethod> = ['POS', 'MANUAL', 'GIFT']
const NON_REVENUE_METHODS: ReadonlyArray<PaymentMethod> = ['TRIAL', 'GIFT']

export const dynamic = 'force-dynamic'

type Period = 'today' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
}

function resolveRange(period: Period): { start: Date; end: Date } {
  const end = new Date()
  if (period === 'today') return { start: getStartOfTodaySV(), end }
  if (period === 'week') return { start: getStartOfWeekSV(), end }
  return { start: getStartOfMonthSV(), end }
}

async function getFinanzasData(period: Period) {
  const { start, end } = resolveRange(period)
  const excludedIds = await getExcludedPurchaseIds()

  const purchases = await prisma.purchase.findMany({
    where: {
      userId: { notIn: EXCLUDED_USER_IDS },
      ...(excludedIds.length > 0 && { id: { notIn: excludedIds } }),
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      userId: true,
      finalPrice: true,
      paymentProviderId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      package: {
        select: {
          name: true,
          disciplines: {
            select: { discipline: { select: { name: true } } },
          },
        },
      },
    },
  })

  const config = getCurrentFinancialConfig()
  const rows: RawPurchase[] = purchases.map((p) => ({
    id: p.id,
    finalPrice: p.finalPrice,
    paymentProviderId: p.paymentProviderId,
    createdAt: p.createdAt,
  }))

  const detailsByDay = new Map<string, DetailRow[]>()
  const disciplineMap = new Map<
    string,
    { revenue: number; orders: number; customerIds: Set<string> }
  >()

  for (const p of purchases) {
    const method = classifyPayment(p.paymentProviderId)
    const disciplines = p.package?.disciplines.map((d) => d.discipline.name) ?? []
    const packageName = p.package?.name ?? '—'

    if (DETAIL_METHODS.includes(method)) {
      const day = formatInTimeZone(p.createdAt, TZ, 'yyyy-MM-dd')
      const list = detailsByDay.get(day) ?? []
      list.push({
        id: p.id,
        userName: p.user?.name ?? '—',
        userEmail: p.user?.email ?? '',
        method,
        amount: p.finalPrice,
        packageName,
        disciplines,
        createdAt: p.createdAt,
      })
      detailsByDay.set(day, list)
    }

    // Discipline distribution — revenue-generating purchases only,
    // split equally when a package spans multiple disciplines.
    if (!NON_REVENUE_METHODS.includes(method) && disciplines.length > 0) {
      const share = p.finalPrice / disciplines.length
      for (const name of disciplines) {
        let s = disciplineMap.get(name)
        if (!s) {
          s = { revenue: 0, orders: 0, customerIds: new Set() }
          disciplineMap.set(name, s)
        }
        s.revenue += share
        s.orders += 1
        s.customerIds.add(p.userId)
      }
    }
  }

  const disciplines: DisciplineStats[] = Array.from(disciplineMap.entries())
    .map(([name, s]) => ({
      name,
      revenue: Math.round(s.revenue * 100) / 100,
      orders: s.orders,
      customers: s.customerIds.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    totals: aggregatePurchases(rows, config),
    daily: groupByDaySV(rows, config),
    detailsByDay,
    disciplines,
    range: { start, end },
    config,
  }
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams?: { period?: string }
}) {
  const rawPeriod = (searchParams?.period ?? 'month') as Period
  const period: Period = (['today', 'week', 'month'] as const).includes(rawPeriod)
    ? rawPeriod
    : 'month'

  const { totals, daily, detailsByDay, disciplines, range, config } =
    await getFinanzasData(period)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-foreground">
            Finanzas
          </h1>
          <p className="text-xs text-gray-400 mt-2">
            Rango: {range.start.toLocaleDateString('es-SV')} —{' '}
            {range.end.toLocaleDateString('es-SV')} ({PERIOD_LABELS[period]})
          </p>
        </div>

        {/* Period selector */}
        <nav className="flex gap-2 bg-white border border-beige rounded-xl p-1 shadow-sm">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => {
            const active = p === period
            return (
              <Link
                key={p}
                href={`/admin/finanzas?period=${p}`}
                className={
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors ' +
                  (active
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-beige')
                }
              >
                {PERIOD_LABELS[p]}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Summary cards — Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          label="Ventas brutas"
          value={formatPrice(totals.bruto)}
          hint={`${totals.count} transacciones`}
          tone="neutral"
        />
        <MetricCard
          icon={<Landmark className="h-5 w-5 text-emerald-600" />}
          label="Dinero al banco (est.)"
          value={formatPrice(totals.neto)}
          hint="Bruto − comisiones Cuscatlán"
          tone="positive"
        />
        <MetricCard
          icon={<Receipt className="h-5 w-5 text-slate-600" />}
          label="IVA"
          value={formatPrice(totals.ivaToPayMinistry)}
          hint="Débito ventas − crédito comisiones"
          tone="neutral"
        />
      </div>

      {/* Discount cards — Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DiscountCard label="IVA ventas (débito)" value={totals.iva} />
        <DiscountCard
          label="Comisión Cuscatlán"
          value={totals.feeBase + totals.feeIva}
          detail={`${(config.gatewayFeeRate * 100).toFixed(2)}% + IVA`}
        />
        <DiscountCard
          label="3DS"
          value={totals.tdsFee}
          detail={`$${config.tds3DsPerTransaction.toFixed(2)} + IVA / transacción`}
        />
      </div>

      {/* Breakdown by payment method */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas por método de pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-beige">
                  <th className="py-2">Método</th>
                  <th className="py-2 text-right">Transacciones</th>
                  <th className="py-2 text-right">Bruto</th>
                  <th className="py-2 text-right">% bruto</th>
                  <th className="py-2 text-right">Comisión</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {(['PAYWAY', 'POS', 'MANUAL'] as const).map((method) => {
                  const m = totals.byMethod[method]
                  if (m.count === 0 || m.bruto === 0) return null
                  const pct = totals.bruto > 0 ? (m.bruto / totals.bruto) * 100 : 0
                  return (
                    <tr key={method} className="border-b border-beige/50">
                      <td className="py-2">
                        <MethodLabel method={method} />
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {m.count}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatPrice(m.bruto)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-600">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right tabular-nums text-red-600">
                        {m.fee > 0 ? `−${formatPrice(m.fee)}` : '—'}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {formatPrice(m.neto)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-3">Total</td>
                  <td className="py-3 text-right tabular-nums">
                    {totals.count}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatPrice(totals.bruto)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-gray-600">
                    100%
                  </td>
                  <td className="py-3 text-right tabular-nums text-red-600">
                    −{formatPrice(totals.fee)}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatPrice(totals.neto)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Discipline distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por disciplina</CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Ingresos atribuidos equitativamente cuando un paquete cubre varias disciplinas.
            Excluye cortesías y trials.
          </p>
        </CardHeader>
        <CardContent>
          {disciplines.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Sin ventas por disciplina en el rango.
            </p>
          ) : (
            <DisciplineTable disciplines={disciplines} />
          )}
        </CardContent>
      </Card>

      {/* Daily breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose diario</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Sin ventas en el rango seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-beige">
                    <th className="py-2">Fecha</th>
                    <th className="py-2 text-right">Transacciones</th>
                    <th className="py-2 text-right">Bruto</th>
                    <th className="py-2 text-right">IVA</th>
                    <th className="py-2 text-right">Comisiones</th>
                    <th className="py-2 text-right">Neto al banco</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => {
                    const details = detailsByDay.get(d.day) ?? []
                    return (
                      <React.Fragment key={d.day}>
                        <tr className="border-b border-beige/50">
                          <td className="py-2 font-medium">{d.day}</td>
                          <td className="py-2 text-right tabular-nums">
                            {d.count}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPrice(d.bruto)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-600">
                            {formatPrice(d.iva)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-red-600">
                            {d.fee > 0 ? `−${formatPrice(d.fee)}` : '—'}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium text-emerald-700">
                            {formatPrice(d.neto)}
                          </td>
                        </tr>
                        {details.length > 0 && (
                          <tr className="border-b border-beige/50 bg-beige/20">
                            <td colSpan={6} className="py-2 px-3">
                              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                                POS / Transferencia / Cortesías
                              </p>
                              <ul className="space-y-1.5">
                                {details.map((row) => (
                                  <li
                                    key={row.id}
                                    className="flex items-start justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <DetailMethodBadge method={row.method} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="truncate text-gray-800 font-medium">
                                            {row.userName}
                                          </span>
                                          <span className="truncate text-gray-400">
                                            {row.userEmail}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                                          <span className="truncate">
                                            {row.packageName}
                                          </span>
                                          {row.disciplines.length > 0 && (
                                            <>
                                              <span>·</span>
                                              <span className="truncate">
                                                {row.disciplines.join(', ')}
                                              </span>
                                            </>
                                          )}
                                          <span>·</span>
                                          <span className="tabular-nums">
                                            {formatInTimeZone(row.createdAt, TZ, 'HH:mm')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <span className="tabular-nums text-gray-700 whitespace-nowrap">
                                      {row.method === 'GIFT'
                                        ? 'Cortesía'
                                        : formatPrice(row.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'neutral' | 'positive'
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p
          className={
            'font-serif text-3xl font-semibold ' +
            (tone === 'positive' ? 'text-emerald-700' : 'text-foreground')
          }
        >
          {value}
        </p>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

function DiscountCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </p>
          <ArrowDownRight className="h-4 w-4 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-xl font-semibold text-slate-700 tabular-nums">
          {value > 0 ? `−${formatPrice(value)}` : formatPrice(0)}
        </p>
        {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
      </CardContent>
    </Card>
  )
}

function DetailMethodBadge({ method }: { method: PaymentMethod }) {
  const cfg: Partial<Record<PaymentMethod, { label: string; className: string }>> = {
    POS: { label: 'POS', className: 'bg-indigo-50 text-indigo-700' },
    MANUAL: { label: 'Transferencia', className: 'bg-purple-50 text-purple-700' },
    GIFT: { label: 'Cortesía', className: 'bg-amber-50 text-amber-700' },
  }
  const c = cfg[method] ?? { label: method, className: 'bg-gray-100 text-gray-700' }
  return (
    <span
      className={
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ' +
        c.className
      }
    >
      {c.label}
    </span>
  )
}

const DISCIPLINE_COLORS = [
  '#639922',
  '#8B7355',
  '#A6B7A8',
  '#D4A574',
  '#6B8E7B',
  '#C99A6B',
]

function DisciplineTable({ disciplines }: { disciplines: DisciplineStats[] }) {
  const total = disciplines.reduce((sum, d) => sum + d.revenue, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-beige">
            <th className="py-2 w-8">#</th>
            <th className="py-2">Disciplina</th>
            <th className="py-2 text-right">Ingresos</th>
            <th className="py-2 text-right">Clientes</th>
            <th className="py-2 text-right">Órdenes</th>
            <th className="py-2 text-right w-[28%]">%</th>
          </tr>
        </thead>
        <tbody>
          {disciplines.map((d, i) => {
            const pct = total > 0 ? (d.revenue / total) * 100 : 0
            const color = DISCIPLINE_COLORS[i % DISCIPLINE_COLORS.length]
            return (
              <tr key={d.name} className="border-b border-beige/50">
                <td className="py-2 text-gray-500 tabular-nums">{i + 1}</td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {d.name}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums font-medium">
                  {formatPrice(d.revenue)}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-600">
                  {d.customers}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-600">
                  {d.orders}
                </td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-beige/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-gray-600 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-3" colSpan={2}>Total</td>
            <td className="py-3 text-right tabular-nums">{formatPrice(total)}</td>
            <td className="py-3" colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

type RevenueMethod = 'PAYWAY' | 'POS' | 'MANUAL'

function MethodLabel({ method }: { method: RevenueMethod }) {
  const cfg: Record<RevenueMethod, { label: string; className: string; icon: React.ReactNode }> = {
    PAYWAY: {
      label: 'Pago en línea',
      className: 'bg-blue-50 text-blue-700',
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    POS: {
      label: 'Pago por POS',
      className: 'bg-indigo-50 text-indigo-700',
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    MANUAL: {
      label: 'Transferencia / Efectivo',
      className: 'bg-purple-50 text-purple-700',
      icon: <DollarSign className="h-3.5 w-3.5" />,
    },
  }
  const c = cfg[method]
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ' +
        c.className
      }
    >
      {c.icon}
      {c.label}
    </span>
  )
}
