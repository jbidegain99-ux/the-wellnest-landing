'use client'

import * as React from 'react'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
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

const disciplineOptions = [
  'Yoga',
  'Pilates Mat',
  'Pole Sport',
  'Sound Healing',
  'Nutrición',
]

type Instructor = {
  id: string
  name: string
  role: string
  bio: string
  disciplines: string[]
  image: string | null
  email: string
  phone: string
  active: boolean
}

// Initial mock data based on the real team
const initialInstructors: Instructor[] = [
  {
    id: '1',
    name: 'Nicole Soundy',
    role: 'Instructora de Yoga & Nutricionista',
    bio: 'Nicole combina su pasión por el yoga con su conocimiento en nutrición para ofrecer un enfoque integral de bienestar. Su práctica se centra en la conexión mente-cuerpo y hábitos alimenticios saludables.',
    disciplines: ['Yoga', 'Nutrición'],
    image: null,
    email: 'nicole@thewellnest.sv',
    phone: '+503 7000 0001',
    active: true,
  },
  {
    id: '2',
    name: 'Florence Cervantes',
    role: 'Instructora de Yoga & Pilates Mat',
    bio: 'Florence fusiona su formación en yoga Vinyasa y Pilates Mat para ofrecer clases dinámicas que fortalecen y flexibilizan. Su energía contagiosa motiva a todos a dar lo mejor de sí.',
    disciplines: ['Yoga', 'Pilates Mat'],
    image: null,
    email: 'florence@thewellnest.sv',
    phone: '+503 7000 0002',
    active: true,
  },
  {
    id: '3',
    name: 'Adriana Lopez',
    role: 'Terapeuta de Sound Healing & Nutricionista',
    bio: 'Adriana guía experiencias de Soundbath que transportan a estados profundos de relajación. También ofrece consultas nutricionales personalizadas con un enfoque holístico.',
    disciplines: ['Sound Healing', 'Nutrición'],
    image: null,
    email: 'adriana@thewellnest.sv',
    phone: '+503 7000 0003',
    active: true,
  },
  {
    id: '4',
    name: 'Denisse Soundy',
    role: 'Instructora de Pole Sport',
    bio: 'Denisse crea un ambiente empoderador donde cada estudiante puede explorar su fuerza y creatividad. Sus clases son desafiantes pero siempre accesibles para todos los niveles.',
    disciplines: ['Pole Sport'],
    image: null,
    email: 'denisse@thewellnest.sv',
    phone: '+503 7000 0004',
    active: true,
  },
  {
    id: '5',
    name: 'Kevin Cano',
    role: 'Instructor de Pole Sport',
    bio: 'Kevin combina técnica y expresión artística en sus clases de Pole Sport. Su enfoque se centra en el desarrollo de fuerza funcional y confianza personal.',
    disciplines: ['Pole Sport'],
    image: null,
    email: 'kevin@thewellnest.sv',
    phone: '+503 7000 0005',
    active: true,
  },
]

export default function AdminInstructoresPage() {
  const [instructors, setInstructors] = React.useState<Instructor[]>(initialInstructors)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingInstructor, setEditingInstructor] = React.useState<Instructor | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    role: '',
    bio: '',
    disciplines: [] as string[],
    email: '',
    phone: '',
    active: true,
  })

  const filteredInstructors = instructors.filter(
    (instructor) =>
      instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.disciplines.some((d) =>
        d.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  const openModal = (instructor?: Instructor) => {
    if (instructor) {
      setEditingInstructor(instructor)
      setFormData({
        name: instructor.name,
        role: instructor.role,
        bio: instructor.bio,
        disciplines: instructor.disciplines,
        email: instructor.email,
        phone: instructor.phone,
        active: instructor.active,
      })
    } else {
      setEditingInstructor(null)
      setFormData({
        name: '',
        role: '',
        bio: '',
        disciplines: [],
        email: '',
        phone: '',
        active: true,
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingInstructor(null)
    setFormData({
      name: '',
      role: '',
      bio: '',
      disciplines: [],
      email: '',
      phone: '',
      active: true,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingInstructor) {
      // Update existing instructor
      setInstructors((prev) =>
        prev.map((i) =>
          i.id === editingInstructor.id
            ? { ...i, ...formData }
            : i
        )
      )
    } else {
      // Add new instructor
      const newInstructor: Instructor = {
        id: String(Date.now()),
        ...formData,
        image: null,
      }
      setInstructors((prev) => [...prev, newInstructor])
    }

    closeModal()
  }

  const handleDelete = (id: string) => {
    setInstructors((prev) => prev.filter((i) => i.id !== id))
    setDeleteConfirmId(null)
  }

  const toggleDiscipline = (discipline: string) => {
    setFormData((prev) => ({
      ...prev,
      disciplines: prev.disciplines.includes(discipline)
        ? prev.disciplines.filter((d) => d !== discipline)
        : [...prev.disciplines, discipline],
    }))
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o disciplina..."
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
                    Disciplinas
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Contacto
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
                          <p className="text-sm text-gray-500">{instructor.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {instructor.disciplines.map((discipline) => (
                          <Badge key={discipline} variant="secondary" className="text-xs">
                            {discipline}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <p className="text-gray-600">{instructor.email}</p>
                        <p className="text-gray-500">{instructor.phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={instructor.active ? 'success' : 'error'}>
                        {instructor.active ? 'Activo' : 'Inactivo'}
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

      {filteredInstructors.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron instructores
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={closeModal}>
        <ModalContent className="max-w-lg">
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
              label="Rol / Título"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              placeholder="Ej: Instructora de Yoga"
              required
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Disciplinas
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
              <label className="block text-sm font-medium text-foreground mb-1">
                Biografía
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                }
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-beige-dark bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
                placeholder="Breve descripción del instructor..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
              <Input
                label="Teléfono"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, active: e.target.checked }))
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
              <Button type="submit" className="flex-1">
                {editingInstructor ? 'Guardar Cambios' : 'Agregar Instructor'}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
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
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
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
