'use client'

import * as React from 'react'
import {
  Clock,
  Check,
  X,
  AlertCircle,
  Loader2,
  MessageCircle,
  Copy,
  RefreshCw,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

interface PasswordResetRequest {
  id: string
  email: string
  userName: string | null
  userId: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  tempPassword: string | null
  adminNotes: string | null
  processedBy: string | null
  processedAt: string | null
  createdAt: string
  expiresAt: string
}

interface Counts {
  PENDING: number
  APPROVED: number
  REJECTED: number
  EXPIRED: number
}

export default function AdminResetPasswordPage() {
  const [requests, setRequests] = React.useState<PasswordResetRequest[]>([])
  const [counts, setCounts] = React.useState<Counts>({ PENDING: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0 })
  const [isLoading, setIsLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<string>('PENDING')
  const [selectedRequest, setSelectedRequest] = React.useState<PasswordResetRequest | null>(null)
  const [showApproveModal, setShowApproveModal] = React.useState(false)
  const [showRejectModal, setShowRejectModal] = React.useState(false)
  const [showSuccessModal, setShowSuccessModal] = React.useState(false)
  const [tempPasswordResult, setTempPasswordResult] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = React.useState(false)

  const fetchRequests = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/password-reset-requests?status=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
        setCounts(data.counts)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
      setErrorMessage('Error al cargar las solicitudes')
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setErrorMessage(null)
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setSuccessMessage(null)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/password-reset-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          action: 'approve',
          notes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTempPasswordResult(data.tempPassword)
        setShowApproveModal(false)
        setShowSuccessModal(true)
        fetchRequests()
      } else {
        showError(data.error || 'Error al aprobar la solicitud')
      }
    } catch (error) {
      showError('Error de conexión')
    } finally {
      setIsProcessing(false)
      setNotes('')
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/password-reset-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          action: 'reject',
          notes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Solicitud rechazada')
        setShowRejectModal(false)
        fetchRequests()
      } else {
        showError(data.error || 'Error al rechazar la solicitud')
      }
    } catch (error) {
      showError('Error de conexión')
    } finally {
      setIsProcessing(false)
      setNotes('')
      setSelectedRequest(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="default" className="bg-amber-100 text-amber-800">Pendiente</Badge>
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Aprobada</Badge>
      case 'REJECTED':
        return <Badge variant="default" className="bg-red-100 text-red-800">Rechazada</Badge>
      case 'EXPIRED':
        return <Badge variant="default" className="bg-gray-100 text-gray-600">Expirada</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Hace un momento'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    return `Hace ${diffDays}d`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Solicitudes de Contraseña
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona las solicitudes de recuperación de contraseña
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchRequests()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Instructions Card */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Proceso de verificación:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>El usuario solicita recuperar contraseña desde la app</li>
                <li>Contacta al usuario por WhatsApp para verificar su identidad</li>
                <li>Si es verificado, <strong>Aprueba</strong> la solicitud aquí</li>
                <li>Comparte la contraseña temporal por WhatsApp</li>
                <li><strong>Importante:</strong> Recuérdale que debe cambiar su contraseña desde su perfil</li>
              </ol>
            </div>
          </div>
        </div>
      </Card>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {errorMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'PENDING', label: 'Pendientes', count: counts.PENDING },
          { value: 'APPROVED', label: 'Aprobadas', count: counts.APPROVED },
          { value: 'REJECTED', label: 'Rechazadas', count: counts.REJECTED },
          { value: 'all', label: 'Todas', count: Object.values(counts).reduce((a, b) => a + b, 0) },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-primary text-white'
                : 'bg-beige hover:bg-beige-dark text-foreground'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Requests List */}
      <Card>
        {requests.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay solicitudes {filter !== 'all' ? 'en este estado' : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-beige">
            {requests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-beige/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-medium text-foreground truncate">
                        {request.userName || 'Usuario'}
                      </p>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{request.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Solicitado {formatTimeAgo(request.createdAt)} •
                      Expira: {formatDate(request.expiresAt)}
                    </p>
                    {request.processedBy && (
                      <p className="text-xs text-gray-500 mt-1">
                        Procesado por {request.processedBy}
                      </p>
                    )}
                    {request.status === 'APPROVED' && request.tempPassword && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg inline-flex items-center gap-2">
                        <span className="text-sm font-mono text-green-700">
                          Contraseña: {request.tempPassword}
                        </span>
                        <button
                          onClick={() => copyToClipboard(request.tempPassword!)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {request.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowRejectModal(true)
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowApproveModal(true)
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprobar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Approve Modal */}
      <Modal open={showApproveModal} onOpenChange={setShowApproveModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Aprobar Solicitud</ModalTitle>
            <ModalDescription>
              ¿Verificaste la identidad del usuario por WhatsApp?
            </ModalDescription>
          </ModalHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-beige rounded-lg">
              <p className="font-medium">{selectedRequest?.userName}</p>
              <p className="text-sm text-gray-600">{selectedRequest?.email}</p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium mb-1">Antes de aprobar:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Confirma que hablaste con el usuario por WhatsApp</li>
                <li>Verifica que es el dueño real de la cuenta</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Verificado por WhatsApp con número registrado"
                className="w-full px-3 py-2 border border-beige rounded-lg text-sm resize-none"
                rows={2}
              />
            </div>
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowApproveModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} isLoading={isProcessing}>
              <Check className="h-4 w-4 mr-2" />
              Aprobar y Generar Contraseña
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onOpenChange={setShowRejectModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Rechazar Solicitud</ModalTitle>
            <ModalDescription>
              ¿Estás seguro de rechazar esta solicitud?
            </ModalDescription>
          </ModalHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-beige rounded-lg">
              <p className="font-medium">{selectedRequest?.userName}</p>
              <p className="text-sm text-gray-600">{selectedRequest?.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón del rechazo (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: No se pudo verificar identidad"
                className="w-full px-3 py-2 border border-beige rounded-lg text-sm resize-none"
                rows={2}
              />
            </div>
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReject}
              isLoading={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Success Modal - Shows temp password */}
      <Modal open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <ModalContent>
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
              ¡Contraseña Reseteada!
            </h3>
            <p className="text-gray-600 mb-6">
              Comparte esta contraseña temporal con el usuario:
            </p>

            <div className="bg-beige rounded-xl p-6 mb-6">
              <p className="text-sm text-gray-500 mb-2">Contraseña temporal:</p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-2xl font-mono font-bold text-primary">
                  {tempPasswordResult}
                </code>
                <button
                  onClick={() => copyToClipboard(tempPasswordResult || '')}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                  title="Copiar"
                >
                  {copiedPassword ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Recuerda decirle al usuario:
              </p>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Esta contraseña es temporal</li>
                <li>• Debe cambiarla desde su perfil por seguridad</li>
                <li>• Ir a Perfil → Seguridad → Cambiar Contraseña</li>
              </ul>
            </div>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Tu nueva contraseña temporal para Wellnest es: ${tempPasswordResult}\n\n` +
                `Importante: Por seguridad, cambia esta contraseña desde tu perfil después de iniciar sesión.\n\n` +
                `Ir a: Perfil → Seguridad → Cambiar Contraseña`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Enviar por WhatsApp
            </a>
          </div>

          <ModalFooter>
            <Button
              onClick={() => {
                setShowSuccessModal(false)
                setTempPasswordResult(null)
                setSelectedRequest(null)
              }}
              className="w-full"
            >
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
