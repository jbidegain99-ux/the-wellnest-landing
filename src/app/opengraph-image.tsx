import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'nodejs'
export const revalidate = 604800 // 7 días - la imagen es estática

// Metadata de la imagen
export const alt = 'Wellnest | Estudio de Bienestar Integral en El Salvador'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Paleta de marca Wellnest
const CREAM = '#FFF8EF'
const BEIGE = '#F3ECE0'
const SAGE = '#9CAF88'
const SAGE_DARK = '#6B7F5E'
const BROWN_DARK = '#453C34'
const BROWN = '#5D4E42'
const GOLD = '#C4A77D'

// Carga la fuente Quicksand desde Google Fonts (devuelve TTF, compatible con Satori)
async function loadQuicksand(weight: number): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Quicksand:wght@${weight}`
    const css = await (await fetch(cssUrl)).text()
    const match = css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/)
    if (!match) return null
    return await (await fetch(match[1])).arrayBuffer()
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const [regular, medium, bold] = await Promise.all([
    loadQuicksand(400),
    loadQuicksand(500),
    loadQuicksand(700),
  ])

  const fonts = [
    regular && { name: 'Quicksand', data: regular, weight: 400 as const, style: 'normal' as const },
    medium && { name: 'Quicksand', data: medium, weight: 500 as const, style: 'normal' as const },
    bold && { name: 'Quicksand', data: bold, weight: 700 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: 'normal' }[]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 80,
          position: 'relative',
          backgroundColor: CREAM,
          backgroundImage: `radial-gradient(circle at 82% 18%, rgba(156,175,136,0.28) 0%, rgba(156,175,136,0) 45%), radial-gradient(circle at 12% 92%, rgba(196,167,125,0.20) 0%, rgba(196,167,125,0) 42%), linear-gradient(135deg, ${CREAM} 0%, ${BEIGE} 100%)`,
          fontFamily: 'Quicksand',
        }}
      >
        {/* Marco editorial premium */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: `1.5px solid rgba(156,175,136,0.45)`,
            borderRadius: 24,
            display: 'flex',
          }}
        />

        {/* Marca "W" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 132,
            height: 132,
            borderRadius: 999,
            backgroundColor: 'rgba(156,175,136,0.14)',
            marginBottom: 30,
          }}
        >
          <svg width="88" height="88" viewBox="0 0 512 512" fill="none">
            <path
              d="M128 96 L192 416 L256 224 L320 416 L384 96"
              stroke={SAGE_DARK}
              strokeWidth="52"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            fontSize: 108,
            fontWeight: 500,
            color: BROWN_DARK,
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          wellnest.
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: 24,
            fontWeight: 500,
            color: SAGE_DARK,
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
          }}
        >
          The Soul Hub
        </div>

        {/* Divisor */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 28,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', width: 60, height: 2, backgroundColor: GOLD, opacity: 0.6 }} />
          <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, backgroundColor: SAGE, margin: '0 14px' }} />
          <div style={{ display: 'flex', width: 60, height: 2, backgroundColor: GOLD, opacity: 0.6 }} />
        </div>

        {/* Slogan */}
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 400,
            color: BROWN,
            textAlign: 'center',
            maxWidth: 760,
          }}
        >
          Donde cuerpo, mente y energía se reencuentran.
        </div>

        {/* Disciplinas */}
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 18,
            fontWeight: 500,
            color: 'rgba(93,78,66,0.7)',
            letterSpacing: '0.18em',
          }}
        >
          MAT PILATES&nbsp;&nbsp;·&nbsp;&nbsp;YOGA&nbsp;&nbsp;·&nbsp;&nbsp;POLE&nbsp;&nbsp;·&nbsp;&nbsp;SOUND BATH&nbsp;&nbsp;·&nbsp;&nbsp;NUTRITION
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 66,
            display: 'flex',
            fontSize: 18,
            fontWeight: 500,
            color: SAGE_DARK,
            letterSpacing: '0.12em',
          }}
        >
          wellneststudio.net
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  )
}
