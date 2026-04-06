'use client'

import * as React from 'react'
import {
  Loader2,
  Clock,
  ShoppingCart,
  UserPlus,
  AlertTriangle,
  UserMinus,
  TrendingUp,
  Flame,
  UserX,
  BarChart3,
  MessageCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatPrice, formatDate } from '@/lib/utils'

// --- Types ---

interface OpportunitySummary {
  expiringThisWeek: number
  abandonedCarts: number
  trialNoConversion: number
  lowRemaining: number
  inactiveUsers: number
  upsellCandidates: number
  highDemandClasses: number
  recurringNoShows: number
  lowOccupancyClasses: number
}

interface ExpiringPackage {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  packageName: string
  packagePrice: number
  classesRemaining: number
  expiresAt: string
  daysUntilExpiry: number
}

interface AbandonedCart {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  packageName: string
  amount: number
  attemptDate: string
  daysSinceAttempt: number
}

interface TrialUser {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  trialDate: string
  daysSinceTrial: number
  trialPackage: string
}

interface LowRemaining {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  packageName: string
  classesRemaining: number
  totalClasses: number
  expiresAt: string
}

interface InactiveUser {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  lastPackage: string
  lastPurchaseDate: string
  daysSinceLastPurchase: number
}

interface UpsellCandidate {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  purchaseCount: number
  totalSpent: number
  maxPackageSize: number
}

interface HighDemandClass {
  classId: string
  discipline: string
  instructor: string
  dateTime: string
  enrolled: number
  capacity: number
  occupancyRate: number
}

interface RecurringNoShow {
  userId: string
  userName: string | null
  userEmail: string
  userPhone: string | null
  hasActivePackage: boolean
  noShowCount: number
  lastClass: string
}

interface LowOccupancyDiscipline {
  discipline: string
  classCount: number
  avgOccupancy: number
}

interface Opportunities {
  expiringThisWeek: ExpiringPackage[]
  abandonedCarts: AbandonedCart[]
  trialNoConversion: TrialUser[]
  lowRemaining: LowRemaining[]
  inactiveUsers: InactiveUser[]
  upsellCandidates: UpsellCandidate[]
  highDemandClasses: HighDemandClass[]
  recurringNoShows: RecurringNoShow[]
  lowOccupancyClasses: LowOccupancyDiscipline[]
}

// --- Tab config ---

const tabs = [
  { key: 'expiringThisWeek', label: 'Por vencer', icon: Clock, color: 'text-[var(--color-warning)]', bgColor: 'bg-[var(--color-warning)]/10' },
  { key: 'abandonedCarts', label: 'Carritos', icon: ShoppingCart, color: 'text-[var(--color-error)]', bgColor: 'bg-[var(--color-error)]/10' },
  { key: 'trialNoConversion', label: 'Trial sin pago', icon: UserPlus, color: 'text-accent', bgColor: 'bg-accent/10' },
  { key: 'lowRemaining', label: 'Casi agotados', icon: AlertTriangle, color: 'text-[var(--color-warning)]', bgColor: 'bg-[var(--color-warning)]/10' },
  { key: 'inactiveUsers', label: 'Inactivos', icon: UserMinus, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  { key: 'upsellCandidates', label: 'Upsell', icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
  { key: 'highDemandClasses', label: 'Alta demanda', icon: Flame, color: 'text-[var(--color-error)]', bgColor: 'bg-[var(--color-error)]/10' },
  { key: 'recurringNoShows', label: 'No-shows', icon: UserX, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  { key: 'lowOccupancyClasses', label: 'Baja ocupacion', icon: BarChart3, color: 'text-gray-500', bgColor: 'bg-gray-100' },
] as const

type TabKey = (typeof tabs)[number]['key']

// --- Helpers ---

function whatsappLink(phone: string | null, message: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, '')
  const number = cleaned.startsWith('503') ? cleaned : `503${cleaned}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

function ContactButtons({ phone, email, message }: { phone: string | null; email: string; message: string }) {
  const waLink = whatsappLink(phone, message)
  return (
    <div className="flex items-center gap-1.5">
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      )}
      <a
        href={`mailto:${email}?subject=Wellnest Studio&body=${encodeURIComponent(message)}`}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        Email
      </a>
    </div>
  )
}

function UserRow({
  userName,
  userEmail,
  userPhone,
  userId,
  hasActivePackage,
  children,
  message,
}: {
  userName: string | null
  userEmail: string
  userPhone: string | null
  userId: string
  hasActivePackage?: boolean
  children: React.ReactNode
  message: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 rounded-lg hover:bg-beige/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`/admin/usuarios/${userId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            {userName || 'Sin nombre'}
          </a>
          <ExternalLink className="h-3 w-3 text-gray-400" />
          {hasActivePackage !== undefined && (
            hasActivePackage ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-700 border border-green-200">
                Paquete activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-600 border border-red-200">
                Sin paquete
              </span>
            )
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{userEmail}</p>
        {children}
      </div>
      <ContactButtons phone={userPhone} email={userEmail} message={message} />
    </div>
  )
}

// --- Main component ---

export default function OportunidadesPage() {
  const [summary, setSummary] = React.useState<OpportunitySummary | null>(null)
  const [opportunities, setOpportunities] = React.useState<Opportunities | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<TabKey>('expiringThisWeek')

  React.useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/opportunities')
        if (response.ok) {
          const data = await response.json()
          setSummary(data.summary)
          setOpportunities(data.opportunities)
        }
      } catch (error) {
        console.error('Error fetching opportunities:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!summary || !opportunities) {
    return (
      <div className="text-center py-12 text-gray-500">
        Error al cargar las oportunidades
      </div>
    )
  }

  const totalOpportunities =
    summary.expiringThisWeek +
    summary.abandonedCarts +
    summary.trialNoConversion +
    summary.lowRemaining +
    summary.inactiveUsers +
    summary.upsellCandidates

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Centro de Oportunidades
        </h1>
        <p className="text-gray-600 mt-1">
          {totalOpportunities} oportunidades de venta identificadas
        </p>
      </div>

      {/* Summary Cards - Sales opportunities */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tabs.slice(0, 6).map((tab) => {
          const Icon = tab.icon
          const count = summary[tab.key as keyof OpportunitySummary]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                activeTab === tab.key
                  ? 'border-primary bg-white shadow-md'
                  : 'border-beige bg-white hover:shadow-sm'
              }`}
            >
              <div className={`p-2 rounded-full ${tab.bgColor} w-fit mb-2`}>
                <Icon className={`h-4 w-4 ${tab.color}`} />
              </div>
              <p className="text-2xl font-serif font-semibold text-foreground">{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{tab.label}</p>
            </button>
          )
        })}
      </div>

      {/* Operational insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.slice(6).map((tab) => {
          const Icon = tab.icon
          const count = summary[tab.key as keyof OpportunitySummary]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                activeTab === tab.key
                  ? 'border-primary bg-white shadow-md'
                  : 'border-beige bg-white hover:shadow-sm'
              }`}
            >
              <div className={`p-2 rounded-full ${tab.bgColor}`}>
                <Icon className={`h-4 w-4 ${tab.color}`} />
              </div>
              <div>
                <p className="text-lg font-serif font-semibold text-foreground">{count}</p>
                <p className="text-xs text-gray-500">{tab.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Active Tab Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const tab = tabs.find((t) => t.key === activeTab)
              if (!tab) return null
              const Icon = tab.icon
              return (
                <>
                  <Icon className={`h-5 w-5 ${tab.color}`} />
                  {tab.label}
                  <Badge variant="secondary" className="ml-2">
                    {summary[activeTab as keyof OpportunitySummary]}
                  </Badge>
                </>
              )
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* --- 1. Expiring this week --- */}
          {activeTab === 'expiringThisWeek' && (
            <div className="divide-y divide-beige">
              {opportunities.expiringThisWeek.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay paquetes por vencer esta semana</p>
              ) : (
                opportunities.expiringThisWeek.map((item) => (
                  <UserRow
                    key={item.userId + item.expiresAt}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Tu paquete ${item.packageName} en Wellnest Studio vence en ${item.daysUntilExpiry} dia(s). Nos encantaria que continues tu practica. Te podemos ayudar a renovar?`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="warning">{item.daysUntilExpiry} dia(s)</Badge>
                      <span className="text-xs text-gray-500">{item.packageName}</span>
                      <span className="text-xs text-gray-500">{item.classesRemaining} clases restantes</span>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 2. Abandoned carts --- */}
          {activeTab === 'abandonedCarts' && (
            <div className="divide-y divide-beige">
              {opportunities.abandonedCarts.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay carritos abandonados</p>
              ) : (
                opportunities.abandonedCarts.map((item) => (
                  <UserRow
                    key={item.userId + item.attemptDate}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Notamos que estuviste interesado(a) en el paquete ${item.packageName} en Wellnest Studio. Podemos ayudarte a completar tu compra?`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-gray-500">{item.packageName}</span>
                      <span className="text-xs font-medium text-foreground">{formatPrice(item.amount)}</span>
                      <Badge variant="error">Hace {item.daysSinceAttempt} dias</Badge>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 3. Trial no conversion --- */}
          {activeTab === 'trialNoConversion' && (
            <div className="divide-y divide-beige">
              {opportunities.trialNoConversion.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">Todos los usuarios trial han comprado un paquete</p>
              ) : (
                opportunities.trialNoConversion.map((item) => (
                  <UserRow
                    key={item.userId}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Esperamos que hayas disfrutado tu clase de prueba en Wellnest Studio. Tenemos paquetes especiales para que continues tu practica. Te gustaria conocerlos?`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-gray-500">{item.trialPackage}</span>
                      <Badge variant="secondary">Hace {item.daysSinceTrial} dias</Badge>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 4. Low remaining --- */}
          {activeTab === 'lowRemaining' && (
            <div className="divide-y divide-beige">
              {opportunities.lowRemaining.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay paquetes casi agotados</p>
              ) : (
                opportunities.lowRemaining.map((item) => (
                  <UserRow
                    key={item.userId + item.packageName}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Te quedan ${item.classesRemaining} clase(s) en tu paquete ${item.packageName}. Quieres que te ayudemos a renovar para que no pierdas tu ritmo?`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="warning">{item.classesRemaining} de {item.totalClasses} clases</Badge>
                      <span className="text-xs text-gray-500">{item.packageName}</span>
                      <span className="text-xs text-gray-500">Vence: {formatDate(new Date(item.expiresAt))}</span>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 5. Inactive users --- */}
          {activeTab === 'inactiveUsers' && (
            <div className="divide-y divide-beige">
              {opportunities.inactiveUsers.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay usuarios inactivos</p>
              ) : (
                opportunities.inactiveUsers.map((item) => (
                  <UserRow
                    key={item.userId}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Te extraniamos en Wellnest Studio. Han pasado ${item.daysSinceLastPurchase} dias desde tu ultimo paquete. Tenemos nuevas clases y horarios que podrian interesarte!`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline">Hace {item.daysSinceLastPurchase} dias</Badge>
                      <span className="text-xs text-gray-500">Ultimo: {item.lastPackage}</span>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 6. Upsell candidates --- */}
          {activeTab === 'upsellCandidates' && (
            <div className="divide-y divide-beige">
              {opportunities.upsellCandidates.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay candidatos de upsell</p>
              ) : (
                opportunities.upsellCandidates.map((item) => (
                  <UserRow
                    key={item.userId}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Hemos notado que eres un cliente frecuente de Wellnest Studio (${item.purchaseCount} compras). Tenemos paquetes mas grandes con mejor precio por clase. Te gustaria conocerlos?`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="success">{item.purchaseCount} compras</Badge>
                      <span className="text-xs font-medium text-foreground">{formatPrice(item.totalSpent)} total</span>
                      <span className="text-xs text-gray-500">Max {item.maxPackageSize} clases/paquete</span>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 7. High-demand classes --- */}
          {activeTab === 'highDemandClasses' && (
            <div>
              {opportunities.highDemandClasses.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay clases con alta demanda reciente</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-beige">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Disciplina</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Instructor</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fecha</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ocupacion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-beige">
                      {opportunities.highDemandClasses.map((cls) => (
                        <tr key={cls.classId}>
                          <td className="py-3 px-4 font-medium text-foreground">{cls.discipline}</td>
                          <td className="py-3 px-4 text-gray-600">{cls.instructor}</td>
                          <td className="py-3 px-4 text-gray-600">{formatDate(new Date(cls.dateTime))}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[var(--color-error)] rounded-full"
                                  style={{ width: `${Math.min(cls.occupancyRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{cls.enrolled}/{cls.capacity}</span>
                              {cls.occupancyRate >= 100 && <Badge variant="error">Lleno</Badge>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {opportunities.highDemandClasses.length > 0 && (
                <p className="text-sm text-gray-500 mt-4 px-4">
                  Estas clases tienen 90%+ de ocupacion. Considera agregar mas horarios para estas disciplinas.
                </p>
              )}
            </div>
          )}

          {/* --- 8. Recurring no-shows --- */}
          {activeTab === 'recurringNoShows' && (
            <div className="divide-y divide-beige">
              {opportunities.recurringNoShows.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay usuarios con no-shows recurrentes (ultimos 30 dias)</p>
              ) : (
                opportunities.recurringNoShows.map((item) => (
                  <UserRow
                    key={item.userId}
                    userId={item.userId}
                    userName={item.userName}
                    userEmail={item.userEmail}
                    userPhone={item.userPhone}
                    hasActivePackage={item.hasActivePackage}
                    message={`Hola ${item.userName || ''}! Hemos notado que no pudiste asistir a algunas clases reservadas. Todo bien? Podemos ayudarte a encontrar horarios mas convenientes.`}
                  >
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="error">{item.noShowCount} no-shows</Badge>
                      <span className="text-xs text-gray-500">Ultima clase: {item.lastClass}</span>
                    </div>
                  </UserRow>
                ))
              )}
            </div>
          )}

          {/* --- 9. Low-occupancy classes --- */}
          {activeTab === 'lowOccupancyClasses' && (
            <div>
              {opportunities.lowOccupancyClasses.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No hay disciplinas con baja ocupacion</p>
              ) : (
                <div className="space-y-4">
                  {opportunities.lowOccupancyClasses.map((item) => (
                    <div key={item.discipline} className="flex items-center justify-between p-4 rounded-lg bg-beige/50">
                      <div>
                        <p className="font-medium text-foreground">{item.discipline}</p>
                        <p className="text-sm text-gray-500">{item.classCount} clases con baja asistencia</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 rounded-full"
                            style={{ width: `${item.avgOccupancy}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{item.avgOccupancy}%</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-sm text-gray-500 mt-2 px-4">
                    Clases con menos del 40% de ocupacion. Considera cambiar horarios, reducir frecuencia, o hacer promociones.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
