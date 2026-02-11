'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email o contraseña incorrectos')
      } else {
        router.push(redirect)
        router.refresh()
      }
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block">
          <span className="font-serif text-3xl font-semibold text-foreground">
            Wellnest
          </span>
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-foreground mt-6">
          Bienvenida de vuelta
        </h1>
        <p className="text-gray-600 mt-2">
          Inicia sesión para reservar tus clases
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
            icon={<Mail className="h-5 w-5" />}
          />

          <div className="relative">
            <Input
              label="Contraseña"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
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

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="remember"
                className="rounded border-beige-dark text-primary focus:ring-primary"
              />
              <span className="text-gray-600">Recordarme</span>
            </label>
            <Link
              href="/recuperar-contrasena"
              className="text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Iniciar Sesión
          </Button>
        </form>
      </div>

      <p className="text-center mt-6 text-gray-600">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-primary hover:underline font-medium">
          Regístrate gratis
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream py-12 px-4">
      <React.Suspense
        fallback={
          <div className="w-full max-w-md text-center">
            <span className="font-serif text-3xl font-semibold text-foreground">
              Wellnest
            </span>
            <div className="mt-8 bg-white rounded-2xl p-8 shadow-sm">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="h-10 bg-gray-200 rounded w-full" />
                <div className="h-10 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </div>
  )
}
