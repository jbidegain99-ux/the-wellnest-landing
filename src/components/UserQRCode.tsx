'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface UserQRCodeProps {
  value: string
  size?: number
}

export function UserQRCode({ value, size = 200 }: UserQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: { dark: '#2D5A4A', light: '#FFFFFF' },
      })
    }
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto rounded-lg"
      style={{ width: size, height: size }}
    />
  )
}
