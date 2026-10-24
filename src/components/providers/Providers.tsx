'use client'

import { SessionProvider } from 'next-auth/react'
import { ProgressGlanceProvider } from '@/components/progress/ProgressGlanceProvider'
import { NewBadgeCelebration } from '@/components/badges/NewBadgeCelebration'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ProgressGlanceProvider>
        {children}
        <NewBadgeCelebration />
      </ProgressGlanceProvider>
    </SessionProvider>
  )
}
