import { eventTheme } from '@/lib/events/format'

/** Fondo de pantalla completa y columna de celular, con el tema del evento. */
export function EventShell({ theme, children }: { theme: string; children: React.ReactNode }) {
  return (
    <div className="ev-root min-h-screen" data-ev-theme={eventTheme(theme)}>
      <div className="relative mx-auto min-h-screen max-w-[440px] overflow-hidden">{children}</div>
    </div>
  )
}
