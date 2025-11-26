'use client'

import * as React from 'react'
import { Download, Search, Trash2, Mail, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'

// Mock subscribers
const subscribers = [
  { id: '1', email: 'maria@example.com', createdAt: new Date('2024-01-15') },
  { id: '2', email: 'ana@example.com', createdAt: new Date('2024-01-14') },
  { id: '3', email: 'laura@example.com', createdAt: new Date('2024-01-10') },
  { id: '4', email: 'sofia@example.com', createdAt: new Date('2024-01-08') },
  { id: '5', email: 'carmen@example.com', createdAt: new Date('2024-01-05') },
  { id: '6', email: 'lucia@example.com', createdAt: new Date('2024-01-03') },
  { id: '7', email: 'elena@example.com', createdAt: new Date('2024-01-01') },
]

export default function AdminNewsletterPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [subscriberList, setSubscriberList] = React.useState(subscribers)

  const filteredSubscribers = subscriberList.filter((sub) =>
    sub.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = (id: string) => {
    if (confirm('¿Estás segura de eliminar este suscriptor?')) {
      setSubscriberList((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const handleExport = () => {
    const csv = [
      'Email,Fecha de Suscripción',
      ...subscriberList.map((s) => `${s.email},${formatDate(s.createdAt)}`),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suscriptores-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Newsletter
          </h1>
          <p className="text-gray-600 mt-1">
            Administra los suscriptores del newsletter
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total suscriptores</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  {subscriberList.length}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Este mes</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  +12
                </p>
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Mail className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasa de apertura</p>
                <p className="text-2xl font-serif font-semibold text-foreground mt-1">
                  42%
                </p>
              </div>
              <div className="p-3 bg-[var(--color-success)]/10 rounded-full">
                <Mail className="h-6 w-6 text-[var(--color-success)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Subscribers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Fecha de suscripción
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {filteredSubscribers.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {subscriber.email}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(subscriber.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(subscriber.id)}
                          className="text-[var(--color-error)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Integration info */}
      <Card>
        <CardHeader>
          <CardTitle>Integración con Email Marketing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Conecta tu cuenta de Mailchimp, SendGrid o Resend para enviar
            campañas de email marketing directamente desde el panel.
          </p>
          <Button variant="outline">Configurar integración</Button>
        </CardContent>
      </Card>
    </div>
  )
}
