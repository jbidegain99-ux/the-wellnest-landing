'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Camera, QrCode, Edit2, Save, X, Check, AlertCircle, Lock, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

export default function PerfilPage() {
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = React.useState(false)
  const [showQR, setShowQR] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = React.useState(false)
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = React.useState(false)
  const [isChangingPassword, setIsChangingPassword] = React.useState(false)

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = React.useState(false)

  // Mock user data - would come from API
  const userData = {
    name: session?.user?.name || 'Usuario',
    email: session?.user?.email || '',
    phone: '+503 1234 5678',
    birthDate: '1990-05-15',
    gender: 'female',
    height: 1.65,
    weight: 58,
    qrCode: 'WN-ABC123XYZ',
  }

  const handleSave = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    setIsEditing(false)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setIsChangingPassword(true)

    // Client-side validation
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres')
      setIsChangingPassword(false)
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      setIsChangingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      })

      const data = await response.json()

      if (response.ok) {
        setPasswordSuccess(true)
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setPasswordError(data.error || 'Error al cambiar la contraseña')
      }
    } catch {
      setPasswordError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordError(null)
    setPasswordSuccess(false)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Mi Perfil
          </h1>
          <p className="text-gray-600 mt-1">
            Administra tu información personal
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            <Edit2 className="h-4 w-4 mr-2" />
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(false)} variant="ghost">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} isLoading={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Photo & QR */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Photo */}
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="relative inline-block">
              <Avatar
                src={session?.user?.image}
                alt={session?.user?.name || ''}
                fallback={session?.user?.name || 'U'}
                size="xl"
                className="w-32 h-32"
              />
              {isEditing && (
                <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-md hover:bg-primary-600 transition-colors">
                  <Camera className="h-5 w-5" />
                </button>
              )}
            </div>
            <h2 className="font-serif text-xl font-semibold text-foreground mt-4">
              {userData.name}
            </h2>
            <p className="text-gray-600 text-sm">{userData.email}</p>
            <Badge variant="default" className="mt-2">
              Miembro Activo
            </Badge>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Mi Código QR</h3>
              <button
                onClick={() => setShowQR(!showQR)}
                className="text-primary text-sm hover:underline"
              >
                {showQR ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {showQR ? (
              <div className="space-y-4">
                <div className="aspect-square bg-beige rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-32 w-32 mx-auto text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">
                      Código QR del usuario
                    </p>
                  </div>
                </div>
                <p className="text-center font-mono text-sm text-gray-600">
                  {userData.qrCode}
                </p>
                <p className="text-xs text-gray-500 text-center">
                  Presenta este código al llegar al estudio para hacer check-in
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Tu código QR único para check-in en el estudio.
              </p>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6">
            <h3 className="font-serif text-xl font-semibold text-foreground mb-6">
              Información Personal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nombre completo"
                defaultValue={userData.name}
                disabled={!isEditing}
              />
              <Input
                label="Email"
                type="email"
                defaultValue={userData.email}
                disabled={!isEditing}
              />
              <Input
                label="Teléfono"
                type="tel"
                defaultValue={userData.phone}
                disabled={!isEditing}
              />
              <Input
                label="Fecha de nacimiento"
                type="date"
                defaultValue={userData.birthDate}
                disabled={!isEditing}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Género (opcional)
                </label>
                <Select
                  defaultValue={userData.gender}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                    <SelectItem value="prefer_not_say">
                      Prefiero no decir
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-6">
                <Input
                  label="Estatura (metros)"
                  type="number"
                  step="0.01"
                  defaultValue={userData.height}
                  disabled={!isEditing}
                />
                <Input
                  label="Peso (kg)"
                  type="number"
                  step="0.1"
                  defaultValue={userData.weight}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              La información de estatura y peso es opcional y solo se utiliza
              para consultas de nutrición.
            </p>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl p-6 mt-6">
            <h3 className="font-serif text-xl font-semibold text-foreground mb-6">
              Seguridad
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-beige">
                <div>
                  <p className="font-medium text-foreground">Contraseña</p>
                  <p className="text-sm text-gray-500">
                    Cambia tu contraseña de acceso
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Cambiar
                </Button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-foreground">
                    Método de pago guardado
                  </p>
                  <p className="text-sm text-gray-500">Visa •••• 4242</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Gestionar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal open={showPasswordModal} onOpenChange={closePasswordModal}>
        <ModalContent>
          {passwordSuccess ? (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  ¡Contraseña Actualizada!
                </h3>
                <p className="text-gray-600">
                  Tu contraseña ha sido cambiada correctamente.
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closePasswordModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>Cambiar Contraseña</ModalTitle>
                <ModalDescription>
                  Ingresa tu contraseña actual y la nueva contraseña
                </ModalDescription>
              </ModalHeader>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <Input
                  label="Contraseña actual"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
                <Input
                  label="Nueva contraseña"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                />
                <Input
                  label="Confirmar nueva contraseña"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                />

                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}

                <ModalFooter>
                  <Button type="button" variant="ghost" onClick={closePasswordModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={isChangingPassword}>
                    Cambiar Contraseña
                  </Button>
                </ModalFooter>
              </form>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Payment Management Modal */}
      <Modal open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Gestionar Método de Pago</ModalTitle>
            <ModalDescription>
              Administra tu forma de pago guardada
            </ModalDescription>
          </ModalHeader>

          <div className="py-6">
            <div className="p-4 bg-beige rounded-xl mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 bg-white rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">VISA</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">•••• •••• •••• 4242</p>
                  <p className="text-sm text-gray-500">Expira 12/25</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Próximamente:</strong> La gestión completa de métodos de pago
                estará disponible pronto. Por ahora, si necesitas actualizar tu método
                de pago, contáctanos por WhatsApp.
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button onClick={() => setShowPaymentModal(false)} className="w-full">
              Entendido
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
