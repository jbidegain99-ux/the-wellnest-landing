import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock, Users, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const disciplines = [
  {
    id: 'yoga',
    name: 'Yoga',
    tagline: 'Encuentra tu equilibrio interior',
    description:
      'El yoga es una práctica milenaria que une cuerpo, mente y espíritu a través de posturas físicas (asanas), técnicas de respiración (pranayama) y meditación. En nuestras clases, te guiamos en un viaje de autoconocimiento y bienestar.',
    benefits: [
      'Mejora la flexibilidad y fuerza muscular',
      'Reduce el estrés y la ansiedad',
      'Aumenta la concentración y claridad mental',
      'Mejora la calidad del sueño',
      'Fortalece el sistema inmunológico',
    ],
    duration: '60-75 min',
    level: 'Todos los niveles',
    image: '/images/disciplines/yoga.jpg',
    color: 'from-[#9CAF88] to-[#6B7F5E]',
  },
  {
    id: 'pilates',
    name: 'Pilates Mat',
    tagline: 'Fortalece tu centro, transforma tu cuerpo',
    description:
      'Pilates Mat se practica en colchoneta y se enfoca en el fortalecimiento del core, la mejora de la postura y la alineación corporal. Nota importante: Nuestras clases son de Pilates Mat, no utilizamos máquinas reformer.',
    benefits: [
      'Fortalece los músculos profundos del core',
      'Mejora la postura y alineación corporal',
      'Aumenta la flexibilidad de forma segura',
      'Previene lesiones y dolores de espalda',
      'Tonifica el cuerpo de manera equilibrada',
    ],
    duration: '55 min',
    level: 'Todos los niveles',
    image: '/images/disciplines/pilates.jpg',
    color: 'from-[#C4A77D] to-[#8B7355]',
  },
  {
    id: 'pole',
    name: 'Pole Fitness',
    tagline: 'Desafía tus límites, empodera tu ser',
    description:
      'Pole Fitness combina danza, acrobacia y fitness en una disciplina que desarrolla fuerza, flexibilidad y confianza. Es un espacio seguro y empoderador donde cada persona puede explorar su potencial.',
    benefits: [
      'Desarrolla fuerza funcional completa',
      'Mejora la coordinación y equilibrio',
      'Aumenta la confianza y autoestima',
      'Quema calorías de forma divertida',
      'Desarrolla flexibilidad y gracia',
    ],
    duration: '60 min',
    level: 'Principiante a Avanzado',
    image: '/images/disciplines/pole-fitness.jpg',
    color: 'from-[#B0B0B0] to-[#8A8A8A]',
  },
  {
    id: 'terapia-de-sonido',
    name: 'Terapia de Sonido',
    tagline: 'Sana a través del sonido',
    description:
      'La Terapia de Sonido es una experiencia meditativa donde te sumerges en frecuencias sanadoras producidas por cuencos tibetanos, gongs y otros instrumentos. Una práctica profundamente relajante que promueve la sanación a nivel celular.',
    benefits: [
      'Reduce el estrés y la ansiedad profundamente',
      'Promueve la relajación profunda',
      'Mejora la calidad del sueño',
      'Equilibra el sistema nervioso',
      'Facilita estados meditativos profundos',
    ],
    duration: '60-90 min',
    level: 'Todos los niveles',
    image: '/images/disciplines/terapia-de-sonido.jpg',
    color: 'from-[#D4C4B0] to-[#C0A888]',
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    tagline: 'Nutre tu cuerpo desde adentro',
    description:
      'Nuestras consultas de nutrición te ofrecen un acompañamiento personalizado para mejorar tu alimentación y alcanzar tus objetivos de bienestar. Trabajamos con un enfoque integral que considera tu estilo de vida y necesidades únicas.',
    benefits: [
      'Plan alimenticio personalizado',
      'Mejora tu relación con la comida',
      'Aumenta tu energía y vitalidad',
      'Alcanza tus objetivos de peso saludable',
      'Aprende hábitos sostenibles',
    ],
    duration: '45-60 min',
    level: 'Consulta individual',
    image: '/images/disciplines/nutricion.jpg',
    color: 'from-[#9CAF88] to-[#C4A77D]',
  },
]

export const metadata = {
  title: 'Clases y Disciplinas | The Wellnest',
  description:
    'Descubre nuestras disciplinas: Yoga, Pilates Mat, Pole Fitness, Terapia de Sonido y Nutrición. Bienestar integral en El Salvador.',
}

export default function ClasesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Nuestras Disciplinas
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explora las diferentes prácticas que ofrecemos y encuentra la que
            resuene contigo. Con nuestros paquetes flexibles, puedes disfrutar
            de todas.
          </p>
        </div>
      </section>

      {/* Disciplines */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {disciplines.map((discipline, index) => (
            <div
              key={discipline.id}
              id={discipline.id}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-mt-24 ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Image */}
              <div
                className={`relative h-80 lg:h-[500px] rounded-3xl overflow-hidden ${
                  index % 2 === 1 ? 'lg:order-2' : ''
                }`}
              >
                <Image
                  src={discipline.image}
                  alt={`Clase de ${discipline.name} en The Wellnest`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                {/* Gradient overlay for legibility */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${discipline.color} opacity-60`}
                />
              </div>

              {/* Content */}
              <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-2">
                  {discipline.name}
                </h2>
                <p className="text-primary text-lg font-medium mb-6">
                  {discipline.tagline}
                </p>
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  {discipline.description}
                </p>

                {/* Meta info */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>{discipline.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-5 w-5 text-primary" />
                    <span>{discipline.level}</span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="mb-8">
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Beneficios
                  </h3>
                  <ul className="space-y-2">
                    {discipline.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-gray-600">
                        <span className="text-primary mt-1">•</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href="/horarios">
                  <Button>
                    Ver Horarios
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-beige">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl font-semibold text-foreground mb-6">
            ¿Lista para comenzar?
          </h2>
          <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
            Con un solo paquete de clases, puedes asistir a cualquiera de nuestras
            disciplinas. Elige según tu estado de ánimo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/paquetes">
              <Button size="lg">
                Ver Paquetes
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/registro">
              <Button size="lg" variant="outline">
                Crear Cuenta
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
