'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegistroPage() {
  const router = useRouter()

  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      password: formData.get('password') as string,
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Error al crear cuenta')
      } else {
        router.push('/login?registered=true')
      }
    } catch (err) {
      setError('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
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
            Crea tu cuenta
          </h1>
          <p className="text-gray-600 mt-2">
            Únete a nuestra comunidad de bienestar
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
              label="Nombre completo"
              name="name"
              type="text"
              placeholder="Tu nombre"
              required
              icon={<User className="h-5 w-5" />}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              required
              icon={<Mail className="h-5 w-5" />}
            />

            <Input
              label="Teléfono"
              name="phone"
              type="tel"
              placeholder="+503 1234 5678"
              icon={<Phone className="h-5 w-5" />}
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                icon={<Lock className="h-5 w-5" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  className="mt-1 rounded border-beige-dark text-primary focus:ring-primary"
                />
                <span className="text-gray-600">
                  Acepto los{' '}
                  <Link href="/terminos" className="text-primary hover:underline">
                    términos y condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link href="/privacidad" className="text-primary hover:underline">
                    política de privacidad
                  </Link>
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Crear Cuenta
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
