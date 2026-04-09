'use client'

import * as React from 'react'
import { Search, Eye, Package, Calendar, Loader2, Check, AlertCircle, Plus, Minus, KeyRound, Share2, Users, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
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

interface SharedMember {
  purchaseId: string
  userId: string
  userName: string | null
  classesRemaining: number
  classesAllocated: number | null
}

interface UserPurchase {
  id: string
  packageId: string
  packageName: string
  classCount: number
  classesRemaining: number
  expiresAt: string
  createdAt: string
  status: string
  finalPrice: number
  sharedGroupId?: string | null
  sharedFromId?: string | null
  classesAllocated?: number | null
  sharedMembers?: SharedMember[]
}

interface ShareAllocation {
  userId: string
  userName: string
  classCount: number
}

interface SearchedUser {
  id: string
  name: string | null
  email: string
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
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pagination, setPagination] = React.useState<PaginationData>({
    current: 1, limit: 10, total: 0, pages: 0,
  })
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null)
  const [showAssignModal, setShowAssignModal] = React.useState(false)
  const [userToAssign, setUserToAssign] = React.useState<User | null>(null)
  const [selectedPackageId, setSelectedPackageId] = React.useState<string>('')
  const [paymentSource, setPaymentSource] =
    React.useState<'POS' | 'MANUAL_TRANSFER' | 'GIFT'>('POS')
  const [sendInvoice, setSendInvoice] = React.useState(true)
  const [isAssigning, setIsAssigning] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Deduct state
  const [showDeductModal, setShowDeductModal] = React.useState(false)
  const [userToDeduct, setUserToDeduct] = React.useState<User | null>(null)
  const [userPurchases, setUserPurchases] = React.useState<UserPurchase[]>([])
  const [selectedPurchaseId, setSelectedPurchaseId] = React.useState<string>('')
  const [deductQuantity, setDeductQuantity] = React.useState(1)
  const [deductReason, setDeductReason] = React.useState('')
  const [isDeducting, setIsDeducting] = React.useState(false)
  const [isLoadingPurchases, setIsLoadingPurchases] = React.useState(false)

  // Password reset state
  const [showResetPasswordModal, setShowResetPasswordModal] = React.useState(false)
  const [userToReset, setUserToReset] = React.useState<User | null>(null)
  const [isResettingPassword, setIsResettingPassword] = React.useState(false)

  // Share package state
  const [showShareModal, setShowShareModal] = React.useState(false)
  const [userToShare, setUserToShare] = React.useState<User | null>(null)
  const [sharePurchases, setSharePurchases] = React.useState<UserPurchase[]>([])
  const [selectedSharePurchaseId, setSelectedSharePurchaseId] = React.useState<string>('')
  const [shareAllocations, setShareAllocations] = React.useState<ShareAllocation[]>([])
  const [shareUserSearch, setShareUserSearch] = React.useState('')
  const [shareSearchResults, setShareSearchResults] = React.useState<SearchedUser[]>([])
  const [isSearchingShareUsers, setIsSearchingShareUsers] = React.useState(false)
  const [isSharing, setIsSharing] = React.useState(false)
  const [isLoadingSharePurchases, setIsLoadingSharePurchases] = React.useState(false)
  const [shareStep, setShareStep] = React.useState<1 | 2 | 3>(1)

  // Debounced search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const shareSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch users from database with pagination
  const fetchUsers = React.useCallback(async (page = 1, search = '', isInitial = false) => {
    if (isInitial) {
      setIsLoading(true)
    } else {
      setIsSearching(true)
    }
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
      setIsSearching(false)
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

  const isInitialLoad = React.useRef(true)

  React.useEffect(() => {
    fetchUsers(currentPage, searchQuery, isInitialLoad.current)
    fetchPackages()
    isInitialLoad.current = false
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
    setPaymentSource('POS')
    setSendInvoice(true)
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
        body: JSON.stringify({
          packageId: selectedPackageId,
          paymentSource,
          sendInvoice,
        }),
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

  const openDeductModal = async (user: User) => {
    setUserToDeduct(user)
    setSelectedPurchaseId('')
    setDeductQuantity(1)
    setDeductReason('')
    setShowDeductModal(true)
    setIsLoadingPurchases(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/purchases`)
      if (response.ok) {
        const data = await response.json()
        setUserPurchases(data.purchases.filter((p: UserPurchase) => p.classesRemaining > 0))
      } else {
        showError('Error al cargar las compras del usuario')
        setUserPurchases([])
      }
    } catch (error) {
      console.error('Error fetching user purchases:', error)
      showError('Error de conexión')
      setUserPurchases([])
    } finally {
      setIsLoadingPurchases(false)
    }
  }

  const selectedPurchase = userPurchases.find(p => p.id === selectedPurchaseId)

  const handleDeductPackage = async () => {
    if (!userToDeduct || !selectedPurchaseId || !deductReason.trim()) return

    setIsDeducting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userToDeduct.id}/deduct-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: selectedPurchaseId,
          quantity: deductQuantity,
          reason: deductReason.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al deducir del paquete')
        return
      }

      showSuccess(result.message || 'Clases deducidas correctamente')
      setShowDeductModal(false)
      setUserToDeduct(null)
      await fetchUsers(currentPage, searchQuery)
    } catch (error) {
      console.error('Error deducting package:', error)
      showError('Error de conexión')
    } finally {
      setIsDeducting(false)
    }
  }

  const openResetPasswordModal = (user: User) => {
    setUserToReset(user)
    setShowResetPasswordModal(true)
  }

  const handleResetPassword = async () => {
    if (!userToReset) return

    setIsResettingPassword(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userToReset.id}/reset-password`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al resetear la contraseña')
        return
      }

      showSuccess(result.message || `Contraseña temporal enviada a ${userToReset.email}`)
      setShowResetPasswordModal(false)
      setUserToReset(null)
    } catch (error) {
      console.error('Error resetting password:', error)
      showError('Error de conexión')
    } finally {
      setIsResettingPassword(false)
    }
  }

  // Share package handlers
  const openShareModal = async (user: User) => {
    setUserToShare(user)
    setSelectedSharePurchaseId('')
    setShareAllocations([])
    setShareUserSearch('')
    setShareSearchResults([])
    setShareStep(1)
    setShowShareModal(true)
    setIsLoadingSharePurchases(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/purchases`)
      if (response.ok) {
        const data = await response.json()
        setSharePurchases(
          data.purchases.filter((p: UserPurchase) => p.classesRemaining > 0 && p.status === 'ACTIVE')
        )
      } else {
        showError('Error al cargar las compras del usuario')
        setSharePurchases([])
      }
    } catch {
      showError('Error de conexión')
      setSharePurchases([])
    } finally {
      setIsLoadingSharePurchases(false)
    }
  }

  const selectedSharePurchase = sharePurchases.find((p) => p.id === selectedSharePurchaseId)

  const handleShareUserSearch = (value: string) => {
    setShareUserSearch(value)
    if (shareSearchTimeoutRef.current) clearTimeout(shareSearchTimeoutRef.current)
    if (!value.trim()) {
      setShareSearchResults([])
      return
    }
    shareSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingShareUsers(true)
      try {
        const response = await fetch(`/api/admin/users?search=${encodeURIComponent(value)}&limit=5`)
        if (response.ok) {
          const data = await response.json()
          // Filter out the source user and already added users
          const addedIds = shareAllocations.map((a) => a.userId)
          setShareSearchResults(
            data.users
              .filter((u: SearchedUser) => u.id !== userToShare?.id && !addedIds.includes(u.id))
              .map((u: User) => ({ id: u.id, name: u.name, email: u.email }))
          )
        }
      } catch {
        // silent
      } finally {
        setIsSearchingShareUsers(false)
      }
    }, 300)
  }

  const addShareAllocation = (user: SearchedUser) => {
    setShareAllocations((prev) => [
      ...prev,
      { userId: user.id, userName: user.name || user.email, classCount: 1 },
    ])
    setShareUserSearch('')
    setShareSearchResults([])
  }

  const removeShareAllocation = (userId: string) => {
    setShareAllocations((prev) => prev.filter((a) => a.userId !== userId))
  }

  const updateAllocationCount = (userId: string, count: number) => {
    setShareAllocations((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, classCount: count } : a))
    )
  }

  const totalAllocated = shareAllocations.reduce((sum, a) => sum + a.classCount, 0)
  const maxShareable = selectedSharePurchase?.classesRemaining ?? 0

  const handleSharePackage = async () => {
    if (!userToShare || !selectedSharePurchaseId || shareAllocations.length === 0) return

    setIsSharing(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userToShare.id}/share-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: selectedSharePurchaseId,
          allocations: shareAllocations.map((a) => ({
            userId: a.userId,
            classCount: a.classCount,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al compartir el paquete')
        return
      }

      showSuccess(result.message || 'Paquete compartido exitosamente')
      setShowShareModal(false)
      setUserToShare(null)
      await fetchUsers(currentPage, searchQuery)
    } catch {
      showError('Error de conexión')
    } finally {
      setIsSharing(false)
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
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            icon={isSearching ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Search className="h-5 w-5" />}
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
                  <tr key={user.id} className="cursor-pointer hover:bg-beige/50 transition-colors" onClick={() => window.location.href = `/admin/usuarios/${user.id}`}>
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
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeductModal(user)}
                        >
                          <Minus className="h-4 w-4 mr-1" />
                          Deducir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openShareModal(user)}
                        >
                          <Share2 className="h-4 w-4 mr-1" />
                          Compartir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResetPasswordModal(user)}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Resetear
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
              <div className="flex flex-wrap gap-2 pt-4 border-t border-beige">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedUser(null)
                    openAssignModal(selectedUser)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Asignar Paquete
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedUser(null)
                    openDeductModal(selectedUser)
                  }}
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Deducir Clases
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedUser(null)
                    openResetPasswordModal(selectedUser)
                  }}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Resetear Contraseña
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

            {selectedPackageId && (() => {
              const selectedPkg = packages.find((p) => p.id === selectedPackageId)
              if (!selectedPkg) return null
              const isGift = paymentSource === 'GIFT'
              const hasPrice = selectedPkg.price > 0

              return (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Fuente del pago
                    </label>
                    <Select
                      value={paymentSource}
                      onValueChange={(v) =>
                        setPaymentSource(v as 'POS' | 'MANUAL_TRANSFER' | 'GIFT')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POS">
                          Pago por POS (tarjeta en terminal)
                        </SelectItem>
                        <SelectItem value="MANUAL_TRANSFER">
                          Transferencia / Efectivo
                        </SelectItem>
                        <SelectItem value="GIFT">Cortesía / Regalo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    className={
                      'p-4 rounded-lg text-sm ' +
                      (isGift
                        ? 'bg-amber-50 border border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800')
                    }
                  >
                    {isGift ? (
                      <p>
                        Cortesía sin costo. No se contabiliza como venta ni se
                        genera factura.
                      </p>
                    ) : (
                      <p>
                        Monto a cobrar:{' '}
                        <strong>${selectedPkg.price.toFixed(2)}</strong>
                        {paymentSource === 'POS'
                          ? ' — registrado como pago por POS.'
                          : ' — registrado como transferencia/efectivo.'}
                      </p>
                    )}
                  </div>

                  {!isGift && hasPrice && (
                    <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendInvoice}
                        onChange={(e) => setSendInvoice(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          Generar factura electrónica
                        </p>
                        <p className="text-blue-600 mt-0.5">
                          Envía la venta al Facturador SV para crear el DTE
                          por ${selectedPkg.price.toFixed(2)}.
                        </p>
                      </div>
                    </label>
                  )}
                </>
              )
            })()}
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
              {paymentSource === 'GIFT'
                ? 'Asignar Cortesía'
                : sendInvoice
                ? 'Asignar y Facturar'
                : 'Asignar Paquete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Deduct Package Modal */}
      <Modal open={showDeductModal} onOpenChange={() => !isDeducting && setShowDeductModal(false)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Deducir Clases</ModalTitle>
          </ModalHeader>

          <div className="py-4 space-y-4">
            {userToDeduct && (
              <div className="p-4 bg-beige rounded-lg">
                <p className="text-sm text-gray-600">Deducir clases de:</p>
                <p className="font-medium text-foreground">
                  {userToDeduct.name || userToDeduct.email}
                </p>
              </div>
            )}

            {isLoadingPurchases ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : userPurchases.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                Este usuario no tiene paquetes con clases disponibles.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar compra
                  </label>
                  <Select
                    value={selectedPurchaseId}
                    onValueChange={(value) => {
                      setSelectedPurchaseId(value)
                      setDeductQuantity(1)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una compra" />
                    </SelectTrigger>
                    <SelectContent>
                      {userPurchases.map((purchase) => (
                        <SelectItem key={purchase.id} value={purchase.id}>
                          {purchase.packageName} ({purchase.classesRemaining} disponibles)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPurchase && (
                  <>
                    <div className="p-3 bg-beige rounded-lg text-sm space-y-1">
                      <p><span className="text-gray-500">Paquete:</span> {selectedPurchase.packageName}</p>
                      <p><span className="text-gray-500">Clases disponibles:</span> {selectedPurchase.classesRemaining}</p>
                      <p><span className="text-gray-500">Expira:</span> {formatDate(new Date(selectedPurchase.expiresAt))}</p>
                      <p><span className="text-gray-500">Estado:</span>{' '}
                        <Badge variant={selectedPurchase.status === 'ACTIVE' ? 'success' : 'error'}>
                          {selectedPurchase.status}
                        </Badge>
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cantidad a deducir
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={selectedPurchase.classesRemaining}
                        value={deductQuantity}
                        onChange={(e) => setDeductQuantity(Math.max(1, Math.min(
                          selectedPurchase.classesRemaining,
                          parseInt(e.target.value) || 1
                        )))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Máximo: {selectedPurchase.classesRemaining}
                      </p>
                    </div>

                    <div>
                      <Textarea
                        label="Motivo de la deducción"
                        placeholder="Ej: Ajuste manual, reembolso parcial, error en asignación..."
                        value={deductReason}
                        onChange={(e) => setDeductReason(e.target.value)}
                        required
                      />
                    </div>

                    {deductQuantity > 0 && deductReason.trim() && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <p>
                          Se deducirán <strong>{deductQuantity}</strong> clase(s) de &quot;{selectedPurchase.packageName}&quot;.
                          Balance resultante: <strong>{selectedPurchase.classesRemaining - deductQuantity}</strong> clase(s).
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeductModal(false)}
              disabled={isDeducting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeductPackage}
              disabled={!selectedPurchaseId || !deductReason.trim() || deductQuantity < 1 || isLoadingPurchases}
              isLoading={isDeducting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Deducción
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={showResetPasswordModal} onOpenChange={() => !isResettingPassword && setShowResetPasswordModal(false)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Resetear Contraseña</ModalTitle>
          </ModalHeader>

          <div className="py-4 space-y-4">
            {userToReset && (
              <>
                <div className="p-4 bg-beige rounded-lg">
                  <p className="text-sm text-gray-600">Resetear contraseña de:</p>
                  <p className="font-medium text-foreground">
                    {userToReset.name || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-gray-500">{userToReset.email}</p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  <p>
                    Se generar&aacute; una contraseña temporal y se enviar&aacute; a <strong>{userToReset.email}</strong>. La contraseña actual del usuario dejar&aacute; de funcionar.
                  </p>
                </div>
              </>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetPasswordModal(false)}
              disabled={isResettingPassword}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              isLoading={isResettingPassword}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Confirmar Reset
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Share Package Modal */}
      <Modal open={showShareModal} onOpenChange={() => !isSharing && setShowShareModal(false)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Compartir Paquete
              </div>
            </ModalTitle>
          </ModalHeader>

          <div className="py-4 space-y-4">
            {userToShare && (
              <div className="p-4 bg-beige rounded-lg">
                <p className="text-sm text-gray-600">Compartir paquete de:</p>
                <p className="font-medium text-foreground">
                  {userToShare.name || userToShare.email}
                </p>
              </div>
            )}

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded ${shareStep >= 1 ? 'bg-primary text-white' : 'bg-beige text-gray-500'}`}>1. Paquete</span>
              <span className="text-gray-300">→</span>
              <span className={`px-2 py-1 rounded ${shareStep >= 2 ? 'bg-primary text-white' : 'bg-beige text-gray-500'}`}>2. Usuarios</span>
              <span className="text-gray-300">→</span>
              <span className={`px-2 py-1 rounded ${shareStep >= 3 ? 'bg-primary text-white' : 'bg-beige text-gray-500'}`}>3. Confirmar</span>
            </div>

            {isLoadingSharePurchases ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sharePurchases.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                Este usuario no tiene paquetes activos con clases disponibles.
              </div>
            ) : (
              <>
                {/* Step 1: Select purchase */}
                {shareStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Seleccionar paquete a compartir
                      </label>
                      <Select
                        value={selectedSharePurchaseId}
                        onValueChange={(value) => {
                          setSelectedSharePurchaseId(value)
                          setShareAllocations([])
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un paquete" />
                        </SelectTrigger>
                        <SelectContent>
                          {sharePurchases.map((purchase) => (
                            <SelectItem key={purchase.id} value={purchase.id}>
                              {purchase.packageName} ({purchase.classesRemaining} disponibles)
                              {purchase.sharedGroupId && ' [Compartido]'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSharePurchase && (
                      <div className="p-3 bg-beige rounded-lg text-sm space-y-1">
                        <p><span className="text-gray-500">Paquete:</span> {selectedSharePurchase.packageName}</p>
                        <p><span className="text-gray-500">Clases disponibles:</span> {selectedSharePurchase.classesRemaining}</p>
                        <p><span className="text-gray-500">Expira:</span> {formatDate(new Date(selectedSharePurchase.expiresAt))}</p>
                        {selectedSharePurchase.sharedMembers && selectedSharePurchase.sharedMembers.length > 0 && (
                          <div className="pt-1">
                            <span className="text-gray-500">Ya compartido con:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedSharePurchase.sharedMembers.map((m) => (
                                <Badge key={m.purchaseId} variant="secondary">
                                  <Users className="h-3 w-3 mr-1" />
                                  {m.userName || 'Sin nombre'} ({m.classesRemaining})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Add users and allocations */}
                {shareStep === 2 && selectedSharePurchase && (
                  <div className="space-y-4">
                    <div className="p-3 bg-beige rounded-lg text-sm">
                      <p><span className="text-gray-500">Paquete:</span> {selectedSharePurchase.packageName}</p>
                      <p><span className="text-gray-500">Disponibles:</span> {selectedSharePurchase.classesRemaining} clases</p>
                    </div>

                    {/* Search users */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Buscar usuario destinatario
                      </label>
                      <div className="relative">
                        <Input
                          placeholder="Buscar por nombre o email..."
                          value={shareUserSearch}
                          onChange={(e) => handleShareUserSearch(e.target.value)}
                          icon={isSearchingShareUsers ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Search className="h-5 w-5" />}
                        />
                        {shareSearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {shareSearchResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                className="w-full px-4 py-2 text-left hover:bg-beige text-sm flex justify-between items-center"
                                onClick={() => addShareAllocation(user)}
                              >
                                <span className="font-medium">{user.name || 'Sin nombre'}</span>
                                <span className="text-gray-500">{user.email}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Allocations list */}
                    {shareAllocations.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">
                          Asignaciones
                        </label>
                        {shareAllocations.map((allocation) => (
                          <div
                            key={allocation.userId}
                            className="flex items-center gap-3 p-3 bg-beige rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">{allocation.userName}</p>
                            </div>
                            <Input
                              type="number"
                              min={1}
                              max={maxShareable - totalAllocated + allocation.classCount}
                              value={allocation.classCount}
                              onChange={(e) =>
                                updateAllocationCount(
                                  allocation.userId,
                                  Math.max(1, Math.min(
                                    maxShareable - totalAllocated + allocation.classCount,
                                    parseInt(e.target.value) || 1
                                  ))
                                )
                              }
                              className="w-20"
                            />
                            <span className="text-sm text-gray-500">clases</span>
                            <button
                              type="button"
                              onClick={() => removeShareAllocation(allocation.userId)}
                              className="p-1 hover:bg-red-100 rounded text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <div className="text-sm text-gray-600 flex justify-between">
                          <span>Total a compartir: <strong>{totalAllocated}</strong></span>
                          <span>Restante para origen: <strong>{maxShareable - totalAllocated}</strong></span>
                        </div>
                        {totalAllocated > maxShareable && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            Las clases asignadas exceden las disponibles
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Confirm */}
                {shareStep === 3 && selectedSharePurchase && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm space-y-2">
                      <p className="font-medium text-green-800">Resumen de la distribución:</p>
                      <div className="space-y-1 text-green-700">
                        <p>
                          <span className="text-green-600">Origen:</span>{' '}
                          {userToShare?.name || userToShare?.email} →{' '}
                          <strong>{maxShareable - totalAllocated}</strong> clases restantes
                        </p>
                        {shareAllocations.map((a) => (
                          <p key={a.userId}>
                            <span className="text-green-600">→</span>{' '}
                            {a.userName}: <strong>{a.classCount}</strong> clases
                          </p>
                        ))}
                      </div>
                      <hr className="border-green-200" />
                      <p className="text-green-700">
                        Paquete: <strong>{selectedSharePurchase.packageName}</strong>
                        {' '}| Vence: {formatDate(new Date(selectedSharePurchase.expiresAt))}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <ModalFooter>
            {shareStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setShareStep((s) => (s > 1 ? (s - 1) as 1 | 2 | 3 : s))}
                disabled={isSharing}
              >
                Atrás
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowShareModal(false)}
              disabled={isSharing}
            >
              Cancelar
            </Button>
            {shareStep < 3 ? (
              <Button
                onClick={() => setShareStep((s) => (s < 3 ? (s + 1) as 1 | 2 | 3 : s))}
                disabled={
                  (shareStep === 1 && !selectedSharePurchaseId) ||
                  (shareStep === 2 && (shareAllocations.length === 0 || totalAllocated > maxShareable))
                }
              >
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={handleSharePackage}
                isLoading={isSharing}
                disabled={shareAllocations.length === 0 || totalAllocated > maxShareable}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Confirmar Compartir
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
