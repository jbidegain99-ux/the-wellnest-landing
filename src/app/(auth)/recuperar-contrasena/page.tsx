'use client'

import * as React from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ocurrió un error. Intenta de nuevo.')
        return
      }

      setIsSubmitted(true)
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <span className="font-serif text-3xl font-semibold text-foreground">
                Wellnest
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
              Revisa tu correo
            </h1>
            <p className="text-gray-600 mb-6">
              Si <strong>{email}</strong> está registrado, recibirás un enlace
              para restablecer tu contraseña.
            </p>

            <div className="bg-beige/50 rounded-xl p-6 mb-6 text-left">
              <p className="text-sm text-gray-700 mb-3">
                El enlace expirará en <strong>1 hora</strong>. Si no encuentras el correo:
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>
                  Revisa tu carpeta de spam o correo no deseado
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>
                  Verifica que el email ingresado sea correcto
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#8226;</span>
                  Si el problema persiste, contáctanos a contact@wellneststudio.net
                </li>
              </ul>
            </div>

            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-serif text-3xl font-semibold text-foreground">
              Wellnest
            </span>
          </Link>
          <h1 className="font-serif text-2xl font-semibold text-foreground mt-6">
            Recuperar contraseña
          </h1>
          <p className="text-gray-600 mt-2">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-5 w-5" />}
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Enviar enlace de recuperación
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
