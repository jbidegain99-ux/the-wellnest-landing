'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  RefreshCw,
  Check,
  X,
  Clock,
  DollarSign,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'

interface RefundRequest {
  id: string
  userId: string
  purchaseId: string
  amount: number
  eligible: boolean
  status: 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'REJECTED'
  reason: string
  policySnapshot: string | null
  notes: string | null
  createdAt: string
  refundedAt: string | null
  user: { id: string; name: string; email: string }
  purchase: {
    id: string
    finalPrice: number
    classesRemaining: number
    package: { name: string; classCount: number }
  }
}

interface StatusCounts {
  PENDING: number
  PROCESSING: number
  REFUNDED: number
  REJECTED: number
}

const statusLabels = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'En proceso', color: 'bg-blue-100 text-blue-800' },
  REFUNDED: { label: 'Reembolsado', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
}

export default function AdminReembolsosPage() {
  const [requests, setRequests] = React.useState<RefundRequest[]>([])
  const [statusCounts, setStatusCounts] = React.useState<StatusCounts>({
    PENDING: 0,
    PROCESSING: 0,
    REFUNDED: 0,
    REJECTED: 0,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedRequest, setSelectedRequest] = React.useState<RefundRequest | null>(null)
  const [actionNotes, setActionNotes] = React.useState('')
  const [customAmount, setCustomAmount] = React.useState<string>('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [filter, setFilter] = React.useState<string | null>(null)

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const url = filter ? `/api/admin/refunds?status=${filter}` : '/api/admin/refunds'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.refundRequests)
        setStatusCounts(data.statusCounts)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchRequests()
  }, [filter])

  const handleAction = async (action: 'approve' | 'reject' | 'processing') => {
    if (!selectedRequest) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId: selectedRequest.id,
          action,
          notes: actionNotes,
          customAmount: customAmount ? parseFloat(customAmount) : undefined,
        }),
      })

      if (response.ok) {
        await fetchRequests()
        setSelectedRequest(null)
        setActionNotes('')
        setCustomAmount('')
      }
    } catch (error) {
      console.error('Error processing refund:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Reembolsos
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona las solicitudes de reembolso
          </p>
        </div>
        <Button onClick={fetchRequests} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setFilter(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === null
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 hover:bg-beige'
          }`}
        >
          Todas ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
        </button>
        {Object.entries(statusLabels).map(([status, { label }]) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-beige'
            }`}
          >
            {label} ({statusCounts[status as keyof StatusCounts]})
          </button>
        ))}
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No hay solicitudes de reembolso</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card
              key={request.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                selectedRequest?.id === request.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedRequest(request)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">
                        {request.user.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusLabels[request.status].color
                        }`}
                      >
                        {statusLabels[request.status].label}
                      </span>
                      {request.eligible && request.status === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Elegible
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{request.user.email}</p>
                    <p className="text-sm">
                      <span className="text-gray-500">Paquete:</span>{' '}
                      {request.purchase.package.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(request.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">
                        ${request.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        de ${request.purchase.finalPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {request.notes && (
                  <div className="mt-4 p-3 bg-beige rounded-lg text-sm text-gray-600">
                    <strong>Notas:</strong> {request.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {selectedRequest && (selectedRequest.status === 'PENDING' || selectedRequest.status === 'PROCESSING') && (
        <Card className="sticky bottom-4 shadow-lg border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Procesar Solicitud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Usuario</p>
                <p className="font-medium">{selectedRequest.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Paquete</p>
                <p className="font-medium">{selectedRequest.purchase.package.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Clases restantes</p>
                <p className="font-medium">
                  {selectedRequest.purchase.classesRemaining} / {selectedRequest.purchase.package.classCount}
                </p>
              </div>
            </div>

            {!selectedRequest.eligible && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Esta solicitud está fuera de la política de cancelación.
                </p>
              </div>
            )}

            <Input
              label="Monto a reembolsar (opcional)"
              type="number"
              step="0.01"
              placeholder={`Sugerido: $${selectedRequest.amount.toFixed(2)}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />

            <Textarea
              label="Notas (opcional)"
              placeholder="Agrega notas sobre esta decisión..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleAction('approve')}
                isLoading={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Aprobar Reembolso
              </Button>
              <Button
                onClick={() => handleAction('reject')}
                isLoading={isProcessing}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
              {selectedRequest.status === 'PENDING' && (
                <Button
                  onClick={() => handleAction('processing')}
                  isLoading={isProcessing}
                  variant="outline"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Marcar en Proceso
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedRequest(null)
                  setActionNotes('')
                  setCustomAmount('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
