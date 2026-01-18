import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Sprout, Sparkles, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'Nuestro Equipo | The Wellnest',
  description:
    'Conoce al equipo de instructores y profesionales de The Wellnest. Expertos apasionados por tu bienestar.',
}

// Force dynamic rendering - always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getInstructors() {
  const instructors = await prisma.instructor.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      order: 'asc',
    },
  })
  return instructors
}

export default async function EquipoPage() {
  const teamMembers = await getInstructors()

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-foreground mb-6">
            Nuestro Equipo
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Conoce a las personas que dan vida a Wellnest. Un equipo apasionado y altamente
            preparado, que cuida cada detalle para guiarte con presencia, técnica y calidez
            en tu camino de bienestar.
          </p>
        </div>
      </section>

      {/* Team Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay miembros del equipo para mostrar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar */}
                    <Avatar
                      src={member.image}
                      alt={member.name}
                      fallback={member.name}
                      size="xl"
                      className="mb-4"
                    />

                    {/* Name */}
                    <h3 className="text-xl sm:text-2xl font-medium text-foreground mb-2">
                      {member.name}
                    </h3>

                    {/* Headline (role) */}
                    {member.headline && (
                      <p className="text-primary font-medium text-sm sm:text-base mb-3 leading-relaxed">
                        {member.headline}
                      </p>
                    )}

                    {/* Tags */}
                    {member.tags && member.tags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {member.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Short Bio */}
                    {member.shortBio && (
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {member.shortBio}
                      </p>
                    )}
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
          <h2 className="text-3xl sm:text-4xl font-medium text-foreground mb-6">
            Nuestros Valores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sprout className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Crecimiento
              </h3>
              <p className="text-gray-600">
                Acompañamos tu proceso. Creemos en el potencial de cada persona
                para transformarse y evolucionar a su propio ritmo.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Autenticidad
              </h3>
              <p className="text-gray-600">
                Honramos lo real. Cada disciplina y cada guía comparte su esencia
                con presencia, conocimiento y cuidado en cada detalle.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">
                Comunidad
              </h3>
              <p className="text-gray-600">
                Creamos un espacio de pertenencia. Fomentamos conexiones genuinas
                que sostienen tu bienestar y este es tu lugar seguro.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
