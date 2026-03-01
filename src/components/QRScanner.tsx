'use client'

import { useRef, useCallback } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  isActive: boolean
}

export function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const handleScan = useCallback(
    (detectedCodes: Array<{ rawValue: string }>) => {
      if (!isActive || !detectedCodes.length) return

      const value = detectedCodes[0].rawValue
      if (!value) return

      // Debounce: ignore same QR scanned within 3 seconds
      const now = Date.now()
      if (value === lastScanRef.current && now - lastScanTimeRef.current < 3000) {
        return
      }

      lastScanRef.current = value
      lastScanTimeRef.current = now
      onScan(value)
    },
    [isActive, onScan]
  )

  if (!isActive) return null

  return (
    <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden">
      <Scanner
        onScan={handleScan}
        onError={(error) => onError?.(error instanceof Error ? error.message : String(error))}
        formats={['qr_code']}
        sound={false}
        components={{ finder: true, torch: false, onOff: false, zoom: false }}
      />
    </div>
  )
}
