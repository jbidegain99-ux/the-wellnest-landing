import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          width="160"
          height="160"
        >
          <path
            d="M128 96 L192 416 L256 224 L320 416 L384 96"
            stroke="#9CAF88"
            strokeWidth="56"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
