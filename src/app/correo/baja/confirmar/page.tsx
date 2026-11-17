import type { Metadata } from 'next'
import Link from 'next/link'
import { MailX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { UNSUBSCRIBE_PATH, validUnsubscribeLink } from '@/lib/progress/emailOptOut'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Resúmenes de clase | Wellnest',
  robots: { index: false, follow: false },
  // El token va en la URL: que no viaje en el Referer a otros sitios.
  referrer: 'no-referrer',
}

interface Props {
  searchParams: { u?: string | string[]; t?: string | string[] }
}

// Enlace "Ya no quiero estos resúmenes" del correo. Abrir esta página no guarda
// nada (los escáneres de enlaces abren los GET): la baja se guarda con el POST
// del botón. Sin sesión; la firma se verifica aquí y otra vez en la API.
export default function ConfirmarBajaPage({ searchParams }: Props) {
  const secret = process.env.NEXTAUTH_SECRET
  const link = secret ? validUnsubscribeLink(searchParams.u, searchParams.t, secret) : null

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-beige">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <MailX className="h-6 w-6 text-primary-600" aria-hidden="true" />
          </div>
          {link ? (
            <>
              <h1 className="text-xl font-semibold text-foreground">
                ¿Dejamos de enviarte los resúmenes de clase?
              </h1>
              <p className="mt-3 text-gray-600">
                Tu progreso sigue en Mi progreso, y puedes volver a activarlos cuando quieras.
              </p>
              <form method="post" action={UNSUBSCRIBE_PATH} className="mt-6">
                <input type="hidden" name="u" value={link.userId} />
                <input type="hidden" name="t" value={link.token} />
                <Button type="submit">Confirmar baja</Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">Este enlace no es válido</h1>
              <p className="mt-3 text-gray-600">
                Puedes elegir si recibes los resúmenes de clase desde Mi progreso.
              </p>
              <Button asChild className="mt-6">
                <Link href="/perfil/progreso">Ir a Mi progreso</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
