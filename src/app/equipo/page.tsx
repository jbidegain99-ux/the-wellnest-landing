import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

const team = [
  {
    id: 1,
    name: 'María García',
    role: 'Fundadora & Instructora de Yoga',
    bio: 'Con más de 10 años de práctica y 5 como instructora certificada, María combina su pasión por el yoga con su visión de crear un espacio de bienestar integral. Su enfoque gentil y su atención personalizada hacen de cada clase una experiencia única.',
    disciplines: ['Yoga', 'Sound Healing'],
    image: null,
  },
  {
    id: 2,
    name: 'Ana Martínez',
    role: 'Instructora de Pilates Mat',
    bio: 'Certificada en Pilates Mat por BASI, Ana se especializa en alineación corporal y rehabilitación postural. Su método se enfoca en la conexión mente-cuerpo y la precisión en cada movimiento.',
    disciplines: ['Pilates Mat'],
    image: null,
  },
  {
    id: 3,
    name: 'Carolina López',
    role: 'Instructora de Pole Sport',
    bio: 'Bailarina profesional y campeona nacional de Pole Sport, Carolina crea un ambiente empoderador donde cada estudiante puede explorar su fuerza y creatividad. Sus clases son desafiantes pero siempre accesibles.',
    disciplines: ['Pole Sport'],
    image: null,
  },
  {
    id: 4,
    name: 'Sofía Hernández',
    role: 'Terapeuta de Sound Healing',
    bio: 'Formada en Nepal y certificada en terapia de sonido, Sofía guía experiencias de Soundbath que transportan a estados profundos de relajación. Su sensibilidad y conocimiento hacen de cada sesión un viaje único.',
    disciplines: ['Sound Healing'],
    image: null,
  },
  {
    id: 5,
    name: 'Dr. Roberto Chen',
    role: 'Nutricionista',
    bio: 'Con especialización en nutrición deportiva y manejo de peso, el Dr. Chen ofrece consultas personalizadas con un enfoque holístico. Su filosofía se centra en crear hábitos sostenibles, no dietas restrictivas.',
    disciplines: ['Nutrición'],
    image: null,
  },
  {
    id: 6,
    name: 'Laura Vega',
    role: 'Instructora de Yoga & Pilates',
    bio: 'Laura fusiona su formación en yoga Vinyasa y Pilates para ofrecer clases dinámicas que fortalecen y flexibilizan. Su energía contagiosa motiva a todos a dar lo mejor de sí.',
    disciplines: ['Yoga', 'Pilates Mat'],
    image: null,
  },
]

export const metadata = {
  title: 'Nuestro Equipo | The Wellnest',
  description:
    'Conoce al equipo de instructores y profesionales de The Wellnest. Expertos apasionados por tu bienestar.',
}

export default function EquipoPage() {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex flex-col items-center text-center">
                  <Avatar
                    src={member.image}
                    alt={member.name}
                    fallback={member.name}
                    size="xl"
                    className="mb-4"
                  />
                  <h3 className="font-serif text-2xl font-semibold text-foreground mb-1">
                    {member.name}
                  </h3>
                  <p className="text-primary font-medium mb-3">{member.role}</p>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {member.disciplines.map((discipline) => (
                      <Badge key={discipline} variant="secondary">
                        {discipline}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {member.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
