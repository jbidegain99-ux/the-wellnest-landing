import { EventForm, EMPTY_EVENT } from '../EventForm'

export default function NuevoEventoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-foreground">Nuevo evento</h1>
      <EventForm initial={EMPTY_EVENT} />
    </div>
  )
}
