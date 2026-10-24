import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Resúmenes de clase | Wellnest',
  robots: { index: false, follow: false },
}

// Confirmación tras el enlace "Ya no quiero estos resúmenes" del correo.
export default function CorreoBajaPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-beige">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <MailCheck className="h-6 w-6 text-primary-600" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Listo, ya no te enviaremos resúmenes de clase.
          </h1>
          <p className="mt-3 text-gray-600">
            Puedes volver a activarlos cuando quieras desde Mi progreso.
          </p>
          <Button asChild className="mt-6">
            <Link href="/perfil/progreso">Ir a Mi progreso</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
