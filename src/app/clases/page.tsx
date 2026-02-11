import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock, Users, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getBrandAssets } from '@/lib/assets'

// Force dynamic rendering - never cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Duración estándar para todas las disciplinas (centralizado)
const DEFAULT_CLASS_DURATION = '45 min'

// Default images as fallback
const DEFAULT_IMAGES = {
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
  pilates: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
  pole: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=1200&q=80',
  'aro-telas': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
  'terapia-de-sonido': 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&q=80',
  nutricion: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
}

// Asset keys mapping
const ASSET_KEYS = {
  yoga: 'discipline_yoga_image_url',
  pilates: 'discipline_pilates_image_url',
  pole: 'discipline_pole_image_url',
  'aro-telas': 'discipline_aerials_image_url',
  'terapia-de-sonido': 'discipline_sound_image_url',
  nutricion: 'discipline_nutrition_image_url',
}

// Base discipline data - Copy exacto del documento Wellnest
const baseDisciplines = [
  {
    id: 'yoga',
    name: 'Yoga',
    tagline: 'Encuentra tu balance interior',
    description:
      'El yoga es una experiencia de presencia: movimiento consciente, respiración y calma. En cada clase te guiamos con cuidado y técnica para que habites tu cuerpo, sueltes tensión y cultives equilibrio—desde donde estés hoy.',
    benefits: [
      'Mayor flexibilidad y fuerza funcional',
      'Reduce el estrés y aquieta la mente',
      'Mejora el enfoque y la claridad mental',
      'Favorece un descanso más profundo',
      'Apoya tu sistema inmunológico y bienestar integral',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Todos los niveles',
    color: 'from-[#959D93]/50 to-[#7A9A6D]/50',
  },
  {
    id: 'pilates',
    name: 'Pilates Mat',
    tagline: 'Fortalece tu centro, estiliza tu postura',
    description:
      'Pilates Mat es una práctica en Mat que fortalece el core profundo, mejora la alineación y cultiva un movimiento controlado y elegante. Te guiamos con precisión para que sientas un cuerpo más estable, ligero y armonioso.',
    note: 'Nota: Nuestras clases son Pilates Mat, no utilizamos maquinas reformer.',
    benefits: [
      'Core profundo más fuerte y estable',
      'Mejor postura y alineación corporal',
      'Flexibilidad segura y progresiva',
      'Definición muscular estilizada',
      'Tonificación equilibrada',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Todos los niveles',
    color: 'from-[#111316]/50 to-[#2A2A2A]/50',
  },
  {
    id: 'pole',
    name: 'Pole Fitness',
    tagline: 'Desafía tus límites, empodera tu energía',
    description:
      'Pole es fuerza y arte en un mismo movimiento: construyes potencia, control y confianza, mientras exploras tu expresión con elegancia. Te acompañamos paso a paso en un espacio seguro y motivador, para que celebres tu progreso—sin prisa, sin presión.',
    benefits: [
      'Aumenta fuerza, resistencia y tono muscular',
      'Mejora coordinación, movilidad y control corporal',
      'Desarrolla confianza y conexión con tu cuerpo',
      'Potencia la postura y la estabilidad del core',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Todos los niveles',
    color: 'from-[#B0B0B0]/50 to-[#8A8A8A]/50',
  },
  {
    id: 'aro-telas',
    name: 'Aro y Telas',
    tagline: 'Fluye con confianza',
    description:
      'Aro y Telas (aéreos) es una mezcla perfecta de potencia y ligereza: desarrollas fuerza real, control y flexibilidad mientras aprendés a moverte en el aire con técnica y gracia. Te guiamos paso a paso en un ambiente seguro y motivador, para que disfrutes el proceso, construyas confianza y celebres cada logro—sin prisa, sin presión.',
    benefits: [
      'Fuerza de agarre y antebrazos',
      'Estabilidad de hombros y espalda alta',
      'Técnica de subidas y control de descenso en telas',
      'Control de giros, balances y transiciones en aro',
      'Flexibilidad para líneas y aperturas en el aire',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Todos los niveles',
    color: 'from-[#9B7BB8]/50 to-[#7A5A9E]/50',
  },
  {
    id: 'terapia-de-sonido',
    name: 'Terapia de Sonido',
    tagline: 'Conecta con tu ser interior',
    description:
      'La Terapia de Sonido armoniza tu cuerpo a nivel celular, invitándote al descanso y la reconexión. A través de vibraciones, frecuencias y sonido consciente —acompañadas de meditación guiada— tu cuerpo y tu mente sueltan tensión, regulan emociones y regresan a su estado natural de equilibrio. Ideal si buscas pausar, respirar y recargar desde un espacio seguro y consciente.',
    benefits: [
      'Reduce estrés y ansiedad',
      'Mejora la calidad del sueño',
      'Regula el sistema nervioso',
      'Libera tensión física y mental',
      'Aporta claridad y bienestar emocional',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Todos los niveles',
    color: 'from-[#482F21]/50 to-[#5D4E42]/50',
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    tagline: 'Cuidamos tu salud',
    description:
      'En Wellnest integramos nutrición con nutricionistas especializadas para acompañarte con un enfoque completo: movimiento, hábitos y bienestar en un mismo lugar. Honramos tu estilo de vida, tus necesidades y tu ritmo, para que construyas hábitos reales, sostenibles y con consciencia.',
    benefits: [
      'Plan alimenticio personalizado, práctico y adaptable',
      'Mejora tu relación con la comida, sin culpa ni extremos',
      'Aumenta tu energía y vitalidad',
      'Apoya tus objetivos de peso saludable y bienestar integral',
      'Creas hábitos sostenibles que se mantienen en el tiempo',
    ],
    duration: DEFAULT_CLASS_DURATION,
    level: 'Consulta individual',
    color: 'from-[#B8D4A8]/50 to-[#9AC088]/50',
  },
]

export const metadata = {
  title: 'Clases y Disciplinas | Wellnest',
  description:
    'Descubre nuestras disciplinas: Yoga, Pilates Mat, Pole Fitness, Terapia de Sonido y Nutrición. Bienestar integral en El Salvador.',
}

export default async function ClasesPage() {
  // Load brand assets from database
  const assets = await getBrandAssets()

  // Build disciplines with dynamic images from assets
  const disciplines = baseDisciplines.map((discipline) => {
    const assetKey = ASSET_KEYS[discipline.id as keyof typeof ASSET_KEYS]
    const defaultImage = DEFAULT_IMAGES[discipline.id as keyof typeof DEFAULT_IMAGES]
    return {
      ...discipline,
      image: assets[assetKey]?.url || defaultImage,
    }
  })

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
                  alt={`Clase de ${discipline.name} en Wellnest`}
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
                <p className="text-gray-600 text-lg mb-4 leading-relaxed">
                  {discipline.description}
                </p>

                {/* Note for Pilates */}
                {'note' in discipline && discipline.note && (
                  <p className="text-sm text-primary font-medium mb-4 p-3 bg-primary/5 rounded-lg">
                    {discipline.note}
                  </p>
                )}

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
