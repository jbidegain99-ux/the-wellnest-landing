'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { Camera, QrCode, Edit2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
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
                    Última actualización hace 3 meses
                  </p>
                </div>
                <Button variant="outline" size="sm">
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
                <Button variant="outline" size="sm">
                  Gestionar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
