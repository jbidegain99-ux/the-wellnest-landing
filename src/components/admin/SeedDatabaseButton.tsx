'use client'

import * as React from 'react'
import { Database, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SeedResult {
  success: boolean
  message?: string
  error?: string
  data?: {
    disciplines: number
    instructors: number
    packages: number
    classes: number
  }
}

export function SeedDatabaseButton() {
  const [isSeeding, setIsSeeding] = React.useState(false)
  const [result, setResult] = React.useState<SeedResult | null>(null)

  const handleSeed = async () => {
    if (!confirm('This will reset all data (disciplines, instructors, packages, classes) to the default values. Continue?')) {
      return
    }

    setIsSeeding(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          data: data.data,
        })
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to seed database',
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error. Please try again.',
      })
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleSeed}
        disabled={isSeeding}
        variant="outline"
        className="w-full justify-start"
      >
        {isSeeding ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Database className="h-4 w-4 mr-2" />
        )}
        {isSeeding ? 'Seeding database...' : 'Seed Database'}
      </Button>

      {result && (
        <div
          className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {result.success ? (
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <div>
            {result.success ? (
              <>
                <p className="font-medium">{result.message}</p>
                {result.data && (
                  <ul className="mt-1 text-xs space-y-0.5">
                    <li>{result.data.disciplines} disciplines</li>
                    <li>{result.data.instructors} instructors</li>
                    <li>{result.data.packages} packages</li>
                    <li>{result.data.classes} classes</li>
                  </ul>
                )}
              </>
            ) : (
              <p>{result.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
