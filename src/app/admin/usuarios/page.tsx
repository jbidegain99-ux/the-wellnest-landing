'use client'

import * as React from 'react'
import { Search, Eye, Package, Calendar, Loader2, Check, AlertCircle, Plus } from 'lucide-react'
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
  ModalFooter,
} from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { formatDate } from '@/lib/utils'

interface User {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
  role: string
  createdAt: string
  activePackages: number
  totalClasses: number
  lastActivity: string
  currentPackage: string | null
}

interface Package {
  id: string
  name: string
  classCount: number
  price: number
  validityDays: number
  isActive: boolean
}

interface PaginationData {
  current: number
  limit: number
  total: number
  pages: number
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = React.useState<User[]>([])
  const [packages, setPackages] = React.useState<Package[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pagination, setPagination] = React.useState<PaginationData>({
    current: 1, limit: 10, total: 0, pages: 0,
  })
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null)
  const [showAssignModal, setShowAssignModal] = React.useState(false)
  const [userToAssign, setUserToAssign] = React.useState<User | null>(null)
  const [selectedPackageId, setSelectedPackageId] = React.useState<string>('')
  const [isAssigning, setIsAssigning] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Debounced search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch users from database with pagination
  const fetchUsers = React.useCallback(async (page = 1, search = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      })
      if (search) params.append('search', search)

      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setPagination(data.pagination)
      } else {
        showError('Error al cargar los usuarios')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      showError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch packages for assignment
  const fetchPackages = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/packages')
      if (response.ok) {
        const data = await response.json()
        setPackages(data.filter((p: Package) => p.isActive))
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers(currentPage, searchQuery)
    fetchPackages()
  }, [currentPage, fetchUsers, fetchPackages]) // searchQuery handled via debounce

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setErrorMessage(null)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setSuccessMessage(null)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1)
      fetchUsers(1, value)
    }, 300)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const openAssignModal = (user: User) => {
    setUserToAssign(user)
    setSelectedPackageId('')
    setShowAssignModal(true)
  }

  const handleAssignPackage = async () => {
    if (!userToAssign || !selectedPackageId) return

    setIsAssigning(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userToAssign.id}/assign-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackageId }),
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al asignar el paquete')
        return
      }

      showSuccess(result.message || 'Paquete asignado correctamente')
      setShowAssignModal(false)
      setUserToAssign(null)
      await fetchUsers(currentPage, searchQuery)
    } catch (error) {
      console.error('Error assigning package:', error)
      showError('Error de conexión')
    } finally {
      setIsAssigning(false)
    }
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
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Usuarios
        </h1>
        <p className="text-gray-600 mt-1">
          Administra los usuarios registrados
        </p>
      </div>

      {/* Success/Error Messages */}
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.image}
                          alt={user.name || user.email}
                          fallback={user.name || user.email}
                          size="sm"
                        />
                        <div>
                          <span className="font-medium text-foreground">
                            {user.name || 'Sin nombre'}
                          </span>
                          {user.role === 'ADMIN' && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <p className="text-gray-600">{user.email}</p>
                        {user.phone && (
                          <p className="text-gray-500">{user.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.activePackages > 0 ? (
                        <div>
                          <Badge variant="success">
                            {user.activePackages} activo{user.activePackages > 1 ? 's' : ''}
                          </Badge>
                          {user.currentPackage && (
                            <p className="text-xs text-gray-500 mt-1">{user.currentPackage}</p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="error">Sin paquete</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {user.totalClasses} clases
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(new Date(user.createdAt))}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignModal(user)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Asignar
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

      {users.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron usuarios
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <p className="text-sm text-gray-600">
            Mostrando página <strong>{pagination.current}</strong> de{' '}
            <strong>{pagination.pages}</strong> ({pagination.total} usuarios)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current === 1}
              onClick={() => handlePageChange(pagination.current - 1)}
            >
              Anterior
            </Button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter(p =>
                p === 1 ||
                p === pagination.pages ||
                Math.abs(p - pagination.current) <= 1
              )
              .reduce<(number | string)[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${i}`} className="px-2 py-1 text-gray-400">
                    {p}
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === pagination.current ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current === pagination.pages}
              onClick={() => handlePageChange(pagination.current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

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
                  alt={selectedUser.name || selectedUser.email}
                  fallback={selectedUser.name || selectedUser.email}
                  size="lg"
                />
                <div>
                  <h3 className="font-serif text-xl font-semibold text-foreground">
                    {selectedUser.name || 'Sin nombre'}
                  </h3>
                  <p className="text-gray-600">{selectedUser.email}</p>
                  {selectedUser.phone && (
                    <p className="text-gray-500 text-sm">{selectedUser.phone}</p>
                  )}
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
                    {formatDate(new Date(selectedUser.lastActivity))}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-beige">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedUser(null)
                    openAssignModal(selectedUser)
                  }}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Asignar Paquete
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Assign Package Modal */}
      <Modal open={showAssignModal} onOpenChange={() => !isAssigning && setShowAssignModal(false)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Asignar Paquete</ModalTitle>
          </ModalHeader>

          <div className="py-4 space-y-4">
            {userToAssign && (
              <div className="p-4 bg-beige rounded-lg">
                <p className="text-sm text-gray-600">Asignar paquete a:</p>
                <p className="font-medium text-foreground">
                  {userToAssign.name || userToAssign.email}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Seleccionar paquete
              </label>
              <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un paquete" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.classCount} clases)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPackageId && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <p>Este paquete será asignado sin costo al usuario.</p>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(false)}
              disabled={isAssigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignPackage}
              disabled={!selectedPackageId}
              isLoading={isAssigning}
            >
              Asignar Paquete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
