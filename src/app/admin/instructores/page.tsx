'use client'

import * as React from 'react'
import { Plus, Pencil, Trash2, Search, Loader2, Check, AlertCircle } from 'lucide-react'
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

interface Discipline {
  id: string
  name: string
  slug: string
}

interface Instructor {
  id: string
  name: string
  headline: string | null
  bio: string
  shortBio: string | null
  tags: string[]
  disciplines: string[]
  image: string | null
  isActive: boolean
  order: number
}

export default function AdminInstructoresPage() {
  // Data from database
  const [disciplines, setDisciplines] = React.useState<Discipline[]>([])
  const [instructors, setInstructors] = React.useState<Instructor[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // UI state
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingInstructor, setEditingInstructor] = React.useState<Instructor | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Form state with new fields
  const [formData, setFormData] = React.useState({
    name: '',
    headline: '',
    bio: '',
    shortBio: '',
    tags: [] as string[],
    disciplines: [] as string[],
    isActive: true,
  })

  // Common tags for quick selection
  const commonTags = [
    'Yoga', 'Mat Pilates', 'Pole Fitness', 'Telas', 'Aéreo',
    'Terapia de Sonido', 'Nutrición', 'Nutrición Deportiva',
    'Naturopatía', 'Entrenamiento Funcional', 'Comunidad'
  ]

  // Fetch data from database
  const fetchInstructors = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/instructors')
      if (response.ok) {
        const data = await response.json()
        setInstructors(data)
      }
    } catch (error) {
      console.error('Error fetching instructors:', error)
    }
  }, [])

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [disciplinesRes, instructorsRes] = await Promise.all([
          fetch('/api/disciplines'),
          fetch('/api/admin/instructors'),
        ])

        if (disciplinesRes.ok) {
          const disciplinesData = await disciplinesRes.json()
          setDisciplines(disciplinesData)
        }

        if (instructorsRes.ok) {
          const instructorsData = await instructorsRes.json()
          setInstructors(instructorsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Get discipline names for the form options
  const disciplineOptions = disciplines.map(d => d.name)

  const filteredInstructors = instructors.filter(
    (instructor) =>
      instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.disciplines.some((d) =>
        d.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      instructor.tags?.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  // Generate clean discipline list (without "Instructor/a de" prefix)
  const formatDisciplines = (disciplinesList: string[]): string => {
    if (disciplinesList.length === 0) return 'Sin disciplinas'
    return disciplinesList.join(' · ')
  }

  const openModal = (instructor?: Instructor) => {
    if (instructor) {
      setEditingInstructor(instructor)
      setFormData({
        name: instructor.name,
        headline: instructor.headline || '',
        bio: instructor.bio,
        shortBio: instructor.shortBio || '',
        tags: instructor.tags || [],
        disciplines: instructor.disciplines,
        isActive: instructor.isActive,
      })
    } else {
      setEditingInstructor(null)
      setFormData({
        name: '',
        headline: '',
        bio: '',
        shortBio: '',
        tags: [],
        disciplines: [],
        isActive: true,
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingInstructor(null)
    setFormData({
      name: '',
      headline: '',
      bio: '',
      shortBio: '',
      tags: [],
      disciplines: [],
      isActive: true,
    })
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (editingInstructor) {
        // Update existing instructor
        const response = await fetch(`/api/admin/instructors/${editingInstructor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        const data = await response.json()

        if (!response.ok) {
          showError(data.error || 'Error al actualizar el instructor')
          return
        }

        showSuccess('Instructor actualizado correctamente')
      } else {
        // Create new instructor
        const response = await fetch('/api/admin/instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        const data = await response.json()

        if (!response.ok) {
          showError(data.error || 'Error al crear el instructor')
          return
        }

        showSuccess('Instructor creado correctamente')
      }

      // Refresh the instructors list
      await fetchInstructors()
      closeModal()
    } catch (error) {
      console.error('Error saving instructor:', error)
      showError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/instructors/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || 'Error al eliminar el instructor')
        setDeleteConfirmId(null)
        return
      }

      showSuccess('Instructor eliminado correctamente')
      await fetchInstructors()
    } catch (error) {
      console.error('Error deleting instructor:', error)
      showError('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const toggleDiscipline = (discipline: string) => {
    setFormData((prev) => ({
      ...prev,
      disciplines: prev.disciplines.includes(discipline)
        ? prev.disciplines.filter((d) => d !== discipline)
        : [...prev.disciplines, discipline],
    }))
  }

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }))
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Instructores
          </h1>
          <p className="text-gray-600 mt-1">
            Administra el equipo de instructores
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Instructor
        </Button>
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
            placeholder="Buscar por nombre, disciplina o tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Instructors Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Instructor
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Tags
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
                {filteredInstructors.map((instructor) => (
                  <tr key={instructor.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={instructor.image}
                          alt={instructor.name}
                          fallback={instructor.name}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-foreground">
                            {instructor.name}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                            {instructor.headline || formatDisciplines(instructor.disciplines)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(instructor.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {instructor.tags && instructor.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{instructor.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={instructor.isActive ? 'success' : 'error'}>
                        {instructor.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(instructor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(instructor.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

      {filteredInstructors.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron instructores
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={closeModal}>
        <ModalContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>
              {editingInstructor ? 'Editar Instructor' : 'Agregar Instructor'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <Input
              label="Nombre completo"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />

            <Input
              label="Headline (rol)"
              value={formData.headline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, headline: e.target.value }))
              }
              placeholder="Ej: Nutricionista · Especialidad en Nutrición Deportiva · Maestra de Yoga"
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Disciplinas (para horarios)
              </label>
              <div className="flex flex-wrap gap-2">
                {disciplineOptions.map((discipline) => (
                  <button
                    key={discipline}
                    type="button"
                    onClick={() => toggleDiscipline(discipline)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.disciplines.includes(discipline)
                        ? 'bg-primary text-white'
                        : 'bg-beige text-gray-600 hover:bg-beige-dark'
                    }`}
                  >
                    {discipline}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tags (para página pública)
              </label>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.tags.includes(tag)
                        ? 'bg-primary text-white'
                        : 'bg-beige text-gray-600 hover:bg-beige-dark'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Bio corta (para cards públicas)
              </label>
              <textarea
                value={formData.shortBio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, shortBio: e.target.value }))
                }
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-beige-dark bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
                placeholder="Descripción breve para la card pública..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Biografía completa (interno)
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                }
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-beige-dark bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
                placeholder="Biografía completa del instructor..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="w-4 h-4 rounded border-beige-dark text-primary focus:ring-primary"
              />
              <label htmlFor="active" className="text-sm text-gray-600">
                Instructor activo
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" isLoading={isSaving}>
                {editingInstructor ? 'Guardar Cambios' : 'Agregar Instructor'}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onOpenChange={() => !isDeleting && setDeleteConfirmId(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Confirmar eliminación</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar este instructor? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1"
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                isLoading={isDeleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  )
}
