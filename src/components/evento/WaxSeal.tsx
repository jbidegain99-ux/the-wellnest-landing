const SEAL_PATH =
  'M40 3c4 0 6 3 9 4s7-1 10 1 2 6 4 9 6 4 7 8-2 6-2 10 3 7 2 11-5 5-7 8-1 7-4 9-7 0-10 2-5 6-9 6-6-4-9-5-7 1-10-1-2-6-4-9-6-4-7-8 2-6 2-10-3-7-2-11 5-5 7-8 1-7 4-9 7 0 10-2 5-6 9-6z'
const FLEUR_PATH =
  'M40 22c-1.5 2-2 4-1 6.5-.8-.9-2.2-1.3-3.5-.8-1.8.7-2.3 3-.8 4.3 1 .9 2.6.8 3.3-.2-.3 1.1-1.3 1.7-2.5 1.7h9c-1.2 0-2.2-.6-2.5-1.7.7 1 2.3 1.1 3.3.2 1.5-1.3 1-3.6-.8-4.3-1.3-.5-2.7-.1-3.5.8 1-2.5.5-4.5-1-6.5zM36 35.6h8v1.2h-8zM39.2 36.8h1.6V42h-1.6z'
const CRACK = 'M43 2 L38 22 L45 34 L36 50 L42 64 L37 78'

function SealBody() {
  return (
    <>
      <path fill="#7A141D" d={SEAL_PATH} />
      <circle cx="40" cy="40" r="25" fill="none" stroke="#5A0E15" strokeWidth="2" />
      <path fill="#A0242E" d={FLEUR_PATH} transform="translate(0 6)" />
    </>
  )
}

/**
 * Sello de lacre con la flor de lis. `broken`: se parte en dos mitades que se
 * separan al cargar (600 ms; sin animación con prefers-reduced-motion).
 */
export function WaxSeal({ broken = false, size = 78, className = '' }: { broken?: boolean; size?: number; className?: string }) {
  if (!broken) {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Sello de lacre" className={className}>
        <SealBody />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Sello de lacre roto" className={className} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="ev-seal-left"><path d={`M0 0 L43 0 ${CRACK.replace('M43 2', 'L43 2')} L37 80 L0 80 Z`} /></clipPath>
        <clipPath id="ev-seal-right"><path d={`M80 0 L43 0 ${CRACK.replace('M43 2', 'L43 2')} L37 80 L80 80 Z`} /></clipPath>
      </defs>
      <g className="ev-seal-left" clipPath="url(#ev-seal-left)"><SealBody /></g>
      <g className="ev-seal-right" clipPath="url(#ev-seal-right)"><SealBody /></g>
      <path d={CRACK} fill="none" stroke="#EFE6D6" strokeWidth="2.5" />
    </svg>
  )
}
