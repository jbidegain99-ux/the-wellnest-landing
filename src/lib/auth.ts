import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { checkRateLimit, resetRateLimit } from './rateLimit'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciales inválidas')
        }

        // Frena fuerza bruta por cuenta: 10 intentos / 5 min por email
        const rl = checkRateLimit(
          `login:${credentials.email.trim().toLowerCase()}`,
          10,
          5 * 60 * 1000
        )
        if (!rl.allowed) {
          throw new Error('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
        }

        // 1) match exacto (protege cuentas legacy duplicadas solo por
        // mayúsculas), 2) normalizado, 3) fallback insensible para cuentas
        // legacy con mayúsculas y sin duplicado
        const exactEmail = credentials.email.trim()
        const normalizedEmail = exactEmail.toLowerCase()
        const user =
          (await prisma.user.findUnique({
            where: { email: exactEmail },
          })) ??
          (await prisma.user.findUnique({
            where: { email: normalizedEmail },
          })) ??
          (await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          }))

        if (!user || !user.password) {
          // Mensaje unificado: distinguir 'no existe' de 'password mal' permite
          // enumerar cuentas
          throw new Error('Email o contraseña incorrectos')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error('Email o contraseña incorrectos')
        }

        // Login exitoso: no debe contar contra el limite de fuerza bruta
        resetRateLimit(`login:${normalizedEmail}`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.profileImage,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.authAt = Math.floor(Date.now() / 1000)
        token.revalidatedAt = Date.now()
        return token
      }

      // Re-validar contra la BD cada 10 minutos: sin esto, revocar el rol
      // ADMIN o resetear la contraseña no tiene efecto hasta que el JWT
      // expira (30 días).
      const revalidatedAt = (token.revalidatedAt as number | undefined) ?? 0
      if (token.id && Date.now() - revalidatedAt > 10 * 60 * 1000) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, passwordChangedAt: true },
          })

          const authAt = (token.authAt as number | undefined) ?? 0
          const passwordChangedAfterLogin =
            dbUser?.passwordChangedAt &&
            authAt * 1000 < dbUser.passwordChangedAt.getTime()

          if (!dbUser || passwordChangedAfterLogin) {
            // Sesión invalidada: sin id/role todos los guards devuelven 401
            const mutable = token as Record<string, unknown>
            delete mutable.id
            delete mutable.role
            return token
          }

          token.role = dbUser.role
          token.revalidatedAt = Date.now()
        } catch (err) {
          // Error transitorio de BD: no invalidar la sesión por eso
          console.error('[AUTH] JWT revalidation failed (keeping session):', err)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
