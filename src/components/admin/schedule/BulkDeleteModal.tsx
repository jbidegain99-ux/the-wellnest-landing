'use client'

import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { formatClassType } from '@/lib/utils'
import { formatDateShort } from '@/lib/schedule/classDates'

export interface ClassToDelete {
  id: string
  discipline: string
  classType?: string | null
  time: string
  /** YYYY-MM-DD en calendario de El Salvador. */
  dateStr: string
  reservationsCount: number
}

interface BulkDeleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classes: ClassToDelete[]
  onConfirm: () => void
  isDeleting: boolean
}

export default function BulkDeleteModal({
  open,
  onOpenChange,
  classes,
  onConfirm,
  isDeleting,
}: BulkDeleteModalProps) {
  const blocked = classes.filter((c) => c.reservationsCount > 0)
  const deletable = classes.filter((c) => c.reservationsCount === 0)

  return (
    <Modal open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Eliminar clases</ModalTitle>
        </ModalHeader>

        <div className="py-4 space-y-4">
          <p className="text-gray-600 text-sm">
            {deletable.length === 0
              ? 'Ninguna de las clases seleccionadas se puede eliminar.'
              : `Se ${deletable.length === 1 ? 'eliminará' : 'eliminarán'} ${deletable.length} ${
                  deletable.length === 1 ? 'clase' : 'clases'
                }. Esta acción no se puede deshacer.`}
          </p>

          {deletable.length > 0 && (
            <ul className="max-h-44 overflow-y-auto rounded-lg border border-beige divide-y divide-beige text-sm">
              {deletable.map((cls) => (
                <li key={cls.id} className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-gray-700 truncate">
                    {cls.discipline}
                    {cls.classType && (
                      <span className="text-gray-400"> · {formatClassType(cls.classType)}</span>
                    )}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {formatDateShort(cls.dateStr)} {cls.time}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {blocked.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm space-y-2">
              <p className="flex items-start gap-2 font-medium">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {blocked.length === 1
                  ? '1 clase no se eliminará porque tiene reservas activas:'
                  : `${blocked.length} clases no se eliminarán porque tienen reservas activas:`}
              </p>
              <ul className="max-h-32 overflow-y-auto space-y-1 pl-6">
                {blocked.map((cls) => (
                  <li key={cls.id}>
                    {cls.discipline} · {formatDateShort(cls.dateStr)} {cls.time} ·{' '}
                    {cls.reservationsCount}{' '}
                    {cls.reservationsCount === 1 ? 'reserva' : 'reservas'}
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Para eliminarlas, cancela primero sus reservas desde Asistencias.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              isLoading={isDeleting}
              disabled={deletable.length === 0}
            >
              Eliminar {deletable.length > 0 ? deletable.length : ''}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}
