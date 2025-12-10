import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering to always show fresh data
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nuestro Equipo | The Wellnest',
  description:
    'Conoce al equipo de instructores y profesionales de The Wellnest. Expertos apasionados por tu bienestar.',
}

// Generate role from disciplines
function generateRole(disciplines: string[]): string {
  if (disciplines.length === 0) return 'Instructor'

  const disciplineRoles: Record<string, string> = {
    'yoga': 'Instructor/a de Yoga',
    'pilates': 'Instructor/a de Pilates',
    'pole': 'Instructor/a de Pole Fitness',
    'soundbath': 'Terapeuta de Terapia de Sonido',
    'terapia-de-sonido': 'Terapeuta de Terapia de Sonido',
    'nutricion': 'Nutricionista',
  }

  const roles = disciplines
    .map(d => disciplineRoles[d.toLowerCase()] || `Instructor/a de ${d}`)
    .filter((v, i, a) => a.indexOf(v) === i) // unique roles

  return roles.join(' & ')
}

export default async function EquipoPage() {
  // Fetch instructors from database
  const instructors = await prisma.instructor.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      order: 'asc',
    },
  })

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Nuestro Equipo
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Conoce a las personas apasionadas que hacen de The Wellnest un espacio
            especial. Cada instructor trae su experiencia única para guiarte en
            tu viaje de bienestar.
          </p>
        </div>
      </section>

      {/* Team Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {instructors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No hay instructores disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {instructors.map((instructor) => (
                <div
                  key={instructor.id}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    <Avatar
                      src={instructor.image}
                      alt={instructor.name}
                      fallback={instructor.name}
                      size="xl"
                      className="mb-4"
                    />
                    <h3 className="font-serif text-2xl font-semibold text-foreground mb-1">
                      {instructor.name}
                    </h3>
                    <p className="text-primary font-medium mb-3">
                      {generateRole(instructor.disciplines)}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                      {instructor.disciplines.map((discipline) => (
                        <Badge key={discipline} variant="secondary">
                          {discipline}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {instructor.bio}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-beige">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl font-semibold text-foreground mb-6">
            Nuestros Valores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div>
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Crecimiento
              </h3>
              <p className="text-gray-600">
                Creemos en el potencial de cada persona para transformarse y
                evolucionar.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-4">💫</div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Autenticidad
              </h3>
              <p className="text-gray-600">
                Cada práctica y cada instructor refleja genuinamente su pasión
                y conocimiento.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                Comunidad
              </h3>
              <p className="text-gray-600">
                Fomentamos conexiones significativas entre todos los miembros de
                nuestro estudio.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
