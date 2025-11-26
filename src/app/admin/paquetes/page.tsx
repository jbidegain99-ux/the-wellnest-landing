'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { formatPrice } from '@/lib/utils'

// Mock packages data
const initialPackages = [
  {
    id: '1',
    name: '1 Clase',
    shortDescription: 'Ideal para probar',
    classCount: 1,
    price: 15,
    validityDays: 30,
    isActive: true,
    isFeatured: false,
  },
  {
    id: '2',
    name: '4 Clases',
    shortDescription: 'Una vez por semana',
    classCount: 4,
    price: 50,
    validityDays: 45,
    isActive: true,
    isFeatured: false,
  },
  {
    id: '3',
    name: '8 Clases',
    shortDescription: 'Dos veces por semana',
    classCount: 8,
    price: 90,
    validityDays: 60,
    isActive: true,
    isFeatured: true,
  },
  {
    id: '4',
    name: '12 Clases',
    shortDescription: 'Tres veces por semana',
    classCount: 12,
    price: 120,
    validityDays: 60,
    isActive: true,
    isFeatured: false,
  },
  {
    id: '5',
    name: 'Mensual Ilimitado',
    shortDescription: 'Sin límites',
    classCount: 999,
    price: 150,
    validityDays: 30,
    isActive: true,
    isFeatured: false,
  },
]

export default function AdminPaquetesPage() {
  const [packages, setPackages] = React.useState(initialPackages)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingPackage, setEditingPackage] = React.useState<typeof initialPackages[0] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleEdit = (pkg: typeof initialPackages[0]) => {
    setEditingPackage(pkg)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingPackage(null)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      shortDescription: formData.get('shortDescription') as string,
      classCount: parseInt(formData.get('classCount') as string),
      price: parseFloat(formData.get('price') as string),
      validityDays: parseInt(formData.get('validityDays') as string),
      isActive: formData.get('isActive') === 'on',
      isFeatured: formData.get('isFeatured') === 'on',
    }

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (editingPackage) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingPackage.id ? { ...p, ...data } : p
        )
      )
    } else {
      setPackages((prev) => [
        ...prev,
        { id: Date.now().toString(), ...data },
      ])
    }

    setIsLoading(false)
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar este paquete?')) {
      setPackages((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleActive = (id: string) => {
    setPackages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Paquetes
          </h1>
          <p className="text-gray-600 mt-1">
            Administra los paquetes de clases
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Paquete
        </Button>
      </div>

      {/* Packages Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Nombre
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Clases
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Precio
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Vigencia
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{pkg.name}</p>
                        <p className="text-sm text-gray-500">
                          {pkg.shortDescription}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {pkg.classCount === 999 ? 'Ilimitadas' : pkg.classCount}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {formatPrice(pkg.price)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {pkg.validityDays} días
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={pkg.isActive ? 'success' : 'error'}>
                          {pkg.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {pkg.isFeatured && (
                          <Badge variant="secondary">Destacado</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(pkg)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(pkg.id)}
                        >
                          {pkg.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pkg.id)}
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

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              {editingPackage ? 'Editar Paquete' : 'Nuevo Paquete'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <Input
                label="Nombre"
                name="name"
                defaultValue={editingPackage?.name}
                required
              />
              <Textarea
                label="Descripción corta"
                name="shortDescription"
                defaultValue={editingPackage?.shortDescription}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Número de clases"
                  name="classCount"
                  type="number"
                  min="1"
                  defaultValue={editingPackage?.classCount}
                  required
                />
                <Input
                  label="Precio (USD)"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editingPackage?.price}
                  required
                />
              </div>
              <Input
                label="Vigencia (días)"
                name="validityDays"
                type="number"
                min="1"
                defaultValue={editingPackage?.validityDays}
                required
              />
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingPackage?.isActive ?? true}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={editingPackage?.isFeatured}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Destacado</span>
                </label>
              </div>
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {editingPackage ? 'Guardar Cambios' : 'Crear Paquete'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}
