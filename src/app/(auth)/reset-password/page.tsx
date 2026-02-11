'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type PageStatus = 'form' | 'success' | 'error' | 'expired'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [status, setStatus] = React.useState<PageStatus>(token ? 'form' : 'error')
  const [errorMessage, setErrorMessage] = React.useState('')

  const isValid = password.length >= 8 && password === confirmPassword

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isValid || !token) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error?.includes('expirado')) {
          setStatus('expired')
        } else {
          setErrorMessage(data.error || 'Ocurrió un error.')
        }
        return
      }

      setStatus('success')
    } catch {
      setErrorMessage('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (status === 'success') {
    return (
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
            Contraseña actualizada
          </h1>
          <p className="text-gray-600 mb-8">
            Tu contraseña ha sido restablecida exitosamente.
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Link href="/login">
            <Button className="w-full">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Expired / invalid token state
  if (status === 'expired' || status === 'error') {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-serif text-3xl font-semibold text-foreground">
              Wellnest
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-[var(--color-error)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-[var(--color-error)]" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-4">
            {status === 'expired' ? 'Enlace expirado' : 'Enlace inválido'}
          </h1>
          <p className="text-gray-600 mb-8">
            {status === 'expired'
              ? 'Este enlace de recuperación ha expirado. Solicita uno nuevo para restablecer tu contraseña.'
              : 'El enlace de recuperación no es válido. Asegúrate de usar el enlace completo del email.'}
          </p>
          <div className="space-y-3">
            <Link href="/recuperar-contrasena">
              <Button className="w-full">
                Solicitar nuevo enlace
              </Button>
            </Link>
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

  // Form state
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block">
          <span className="font-serif text-3xl font-semibold text-foreground">
            Wellnest
          </span>
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-foreground mt-6">
          Nueva contraseña
        </h1>
        <p className="text-gray-600 mt-2">
          Ingresa tu nueva contraseña para acceder a tu cuenta
        </p>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm">
        {errorMessage && (
          <div className="mb-6 p-4 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Input
              label="Nueva contraseña"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-5 w-5" />}
              error={password && password.length < 8 ? 'Mínimo 8 caracteres' : undefined}
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

          <div className="relative">
            <Input
              label="Confirmar contraseña"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repite tu contraseña"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="h-5 w-5" />}
              error={confirmPassword && password !== confirmPassword ? 'Las contraseñas no coinciden' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {password && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${password.length >= 8 ? 'bg-primary' : 'bg-gray-300'}`} />
                <span className={password.length >= 8 ? 'text-primary' : 'text-gray-400'}>
                  8 caracteres mínimo
                </span>
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${password === confirmPassword ? 'bg-primary' : 'bg-gray-300'}`} />
                  <span className={password === confirmPassword ? 'text-primary' : 'text-gray-400'}>
                    Las contraseñas coinciden
                  </span>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            disabled={!isValid}
          >
            Restablecer contraseña
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
  )
}

export default function ResetPasswordPage() {
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
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-10 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        }
      >
        <ResetPasswordForm />
      </React.Suspense>
    </div>
  )
}
