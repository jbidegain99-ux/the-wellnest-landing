'use client'

import * as React from 'react'
import { Search, Eye, Package, Calendar, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

// Mock users data
const users = [
  {
    id: '1',
    name: 'María López',
    email: 'maria@example.com',
    phone: '+503 1234 5678',
    image: null,
    createdAt: new Date('2023-12-01'),
    activePackages: 2,
    totalClasses: 24,
    lastActivity: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Ana García',
    email: 'ana@example.com',
    phone: '+503 2345 6789',
    image: null,
    createdAt: new Date('2023-11-15'),
    activePackages: 1,
    totalClasses: 36,
    lastActivity: new Date('2024-01-14'),
  },
  {
    id: '3',
    name: 'Laura Martínez',
    email: 'laura@example.com',
    phone: '+503 3456 7890',
    image: null,
    createdAt: new Date('2024-01-01'),
    activePackages: 1,
    totalClasses: 8,
    lastActivity: new Date('2024-01-13'),
  },
  {
    id: '4',
    name: 'Sofia Chen',
    email: 'sofia@example.com',
    phone: '+503 4567 8901',
    image: null,
    createdAt: new Date('2023-10-20'),
    activePackages: 0,
    totalClasses: 48,
    lastActivity: new Date('2024-01-10'),
  },
]

export default function AdminUsuariosPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedUser, setSelectedUser] = React.useState<typeof users[0] | null>(null)

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Usuarios
        </h1>
        <p className="text-gray-600 mt-1">
          Administra los usuarios registrados
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Usuario
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Contacto
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Paquetes
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Clases
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Miembro desde
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.image}
                          alt={user.name}
                          fallback={user.name}
                          size="sm"
                        />
                        <span className="font-medium text-foreground">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <p className="text-gray-600">{user.email}</p>
                        <p className="text-gray-500">{user.phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.activePackages > 0 ? (
                        <Badge variant="success">
                          {user.activePackages} activo{user.activePackages > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="error">Sin paquete</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {user.totalClasses} clases
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
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

      {/* User Detail Modal */}
      <Modal open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Detalle de Usuario</ModalTitle>
          </ModalHeader>

          {selectedUser && (
            <div className="space-y-6 py-4">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <Avatar
                  src={selectedUser.image}
                  alt={selectedUser.name}
                  fallback={selectedUser.name}
                  size="lg"
                />
                <div>
                  <h3 className="font-serif text-xl font-semibold text-foreground">
                    {selectedUser.name}
                  </h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                  <p className="text-gray-500 text-sm">{selectedUser.phone}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-beige rounded-lg text-center">
                  <Package className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedUser.activePackages}
                  </p>
                  <p className="text-sm text-gray-600">Paquetes</p>
                </div>
                <div className="p-4 bg-beige rounded-lg text-center">
                  <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedUser.totalClasses}
                  </p>
                  <p className="text-sm text-gray-600">Clases</p>
                </div>
                <div className="p-4 bg-beige rounded-lg text-center">
                  <p className="text-sm text-gray-600">Última actividad</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {formatDate(selectedUser.lastActivity)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-beige">
                <Button variant="outline" className="flex-1">
                  <Package className="h-4 w-4 mr-2" />
                  Asignar Clases
                </Button>
                <Button variant="outline" className="flex-1">
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
