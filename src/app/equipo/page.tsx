import Image from 'next/image'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Sprout, Sparkles, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'Nuestro Equipo | Wellnest',
  description:
    'Conoce al equipo de instructores y profesionales de Wellnest. Expertos apasionados por tu bienestar.',
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
                member.image ? (
                  /* Card with background image */
                  <div
                    key={member.id}
                    className="relative rounded-2xl overflow-hidden h-[480px] sm:h-[540px] group shadow-sm hover:shadow-lg transition-shadow duration-300"
                  >
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {/* Gradient overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    {/* Content at bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <h3 className="text-xl font-medium text-white mb-1">
                        {member.name}
                      </h3>
                      {member.headline && (
                        <p className="text-xs font-medium text-white/80 mb-2 leading-relaxed line-clamp-2">
                          {member.headline}
                        </p>
                      )}
                      {member.tags && member.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {member.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {member.shortBio && (
                        <p className="text-xs text-white/80 leading-relaxed line-clamp-5">
                          {member.shortBio}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Fallback card without image (avatar + initials) */
                  <div
                    key={member.id}
                    className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <div className="flex flex-col items-center text-center">
                      <Avatar
                        src={null}
                        alt={member.name}
                        fallback={member.name}
                        size="xl"
                        className="mb-4"
                      />
                      <h3 className="text-xl sm:text-2xl font-medium text-foreground mb-2">
                        {member.name}
                      </h3>
                      {member.headline && (
                        <p className="text-primary font-medium text-sm sm:text-base mb-3 leading-relaxed">
                          {member.headline}
                        </p>
                      )}
                      {member.tags && member.tags.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mb-4">
                          {member.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {member.shortBio && (
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {member.shortBio}
                        </p>
                      )}
                    </div>
                  </div>
                )
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
