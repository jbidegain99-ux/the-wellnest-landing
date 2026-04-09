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
import { getCurrentFinancialConfig } from '@/lib/finance/config'

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
      finalPrice: true,
      paymentProviderId: true,
      createdAt: true,
    },
  })

  const config = getCurrentFinancialConfig()
  const rows: RawPurchase[] = purchases.map((p) => ({
    id: p.id,
    finalPrice: p.finalPrice,
    paymentProviderId: p.paymentProviderId,
    createdAt: p.createdAt,
  }))

  return {
    totals: aggregatePurchases(rows, config),
    daily: groupByDaySV(rows, config),
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

  const { totals, daily, range, config } = await getFinanzasData(period)

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
                  <th className="py-2 text-right">Comisión</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {(['PAYWAY', 'POS', 'MANUAL'] as const).map((method) => {
                  const m = totals.byMethod[method]
                  // Skip buckets with no revenue — avoids showing $0 rows
                  // (e.g. POS with only gifts, or empty methods this period).
                  if (m.count === 0 || m.bruto === 0) return null
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
                  {daily.map((d) => (
                    <tr key={d.day} className="border-b border-beige/50">
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
