import Link from 'next/link'
import { ArrowRight, Leaf, Heart, Sparkles, Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

const disciplines = [
  {
    name: 'Yoga',
    description: 'Encuentra tu equilibrio interior a través de posturas, respiración y meditación.',
    icon: '🧘',
    href: '/clases#yoga',
  },
  {
    name: 'Pilates Mat',
    description: 'Fortalece tu core y mejora tu postura con ejercicios de bajo impacto.',
    icon: '💪',
    href: '/clases#pilates',
  },
  {
    name: 'Pole Sport',
    description: 'Desafía tu fuerza y flexibilidad en un ambiente empoderador.',
    icon: '✨',
    href: '/clases#pole',
  },
  {
    name: 'Sound Healing',
    description: 'Sumérgete en frecuencias sanadoras para una relajación profunda.',
    icon: '🎵',
    href: '/clases#soundhealing',
  },
  {
    name: 'Nutrición',
    description: 'Consultas personalizadas para nutrir tu cuerpo desde adentro.',
    icon: '🥗',
    href: '/clases#nutricion',
  },
]

const benefits = [
  {
    icon: Leaf,
    title: 'Paquetes Flexibles',
    description: 'Usa tus clases en cualquier disciplina según tu estado de ánimo.',
  },
  {
    icon: Heart,
    title: 'Bienestar Integral',
    description: 'Múltiples disciplinas en un solo lugar para tu cuerpo, mente y espíritu.',
  },
  {
    icon: Sparkles,
    title: 'Experiencia Premium',
    description: 'Un espacio diseñado para tu comodidad y relajación total.',
  },
  {
    icon: Users,
    title: 'Comunidad Acogedora',
    description: 'Únete a una comunidad que te apoya en tu viaje de bienestar.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image Placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#6B7F5E] via-[#8B7355] to-[#C4A77D]">
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
          <h1 className="font-serif text-5xl md:text-7xl font-semibold mb-6 animate-fade-in">
            Tu Santuario de Bienestar
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto animate-slide-up">
            Un espacio donde cuerpo, mente y espíritu encuentran armonía.
            Múltiples disciplinas, un solo propósito: tu bienestar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
            <Link href="/paquetes">
              <Button size="lg" className="w-full sm:w-auto">
                Ver Paquetes
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/horarios">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-foreground"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Ver Horarios
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* Disciplines Section */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">
              Nuestras Disciplinas
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Explora nuestras diferentes prácticas y encuentra la que mejor se adapte
              a tu momento. Con un solo paquete, accede a todas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {disciplines.map((discipline) => (
              <Link key={discipline.name} href={discipline.href}>
                <Card className="h-full hover:scale-[1.02] transition-transform duration-300 cursor-pointer group">
                  <CardContent className="p-8">
                    <span className="text-4xl mb-4 block">{discipline.icon}</span>
                    <h3 className="font-serif text-2xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {discipline.name}
                    </h3>
                    <p className="text-gray-600">{discipline.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/clases">
              <Button variant="outline" size="lg">
                Conoce más sobre nuestras clases
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 bg-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">
              ¿Por Qué Elegirnos?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              En The Wellnest creemos que el bienestar es un viaje único para cada persona.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div
                  key={benefit.title}
                  className="flex gap-4 p-6 rounded-2xl bg-white/50 backdrop-blur-sm"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600">{benefit.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-primary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-6">
            Comienza Tu Viaje de Bienestar
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Únete a nuestra comunidad y descubre el poder de cuidar de ti mismo.
            Tu primera clase te está esperando.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/registro">
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
              >
                Crear Cuenta Gratis
              </Button>
            </Link>
            <Link href="/contacto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white text-white hover:bg-white/10"
              >
                Contáctanos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location Preview */}
      <section className="py-24 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-6">
                Visítanos
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                Nuestro estudio está diseñado para ser tu refugio de paz en medio
                de la ciudad. Un espacio luminoso, acogedor y equipado para tu
                práctica de bienestar.
              </p>
              <div className="space-y-4 text-gray-600">
                <p className="flex items-center gap-2">
                  <span className="font-medium">Dirección:</span>
                  Av. De La Revolución, San Salvador, Presidente Plaza, Local #1234
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">Horario:</span>
                  Lunes a Sábado, 6:00 AM - 8:00 PM
                </p>
              </div>
              <div className="mt-8">
                <Link href="/contacto">
                  <Button>
                    Cómo llegar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative h-80 lg:h-96 rounded-2xl overflow-hidden bg-beige-dark">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3876.4!2d-89.2!3d13.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQyJzAwLjAiTiA4OcKwMTInMDAuMCJX!5e0!3m2!1ses!2ssv!4v1700000000000"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación The Wellnest - Presidente Plaza, San Salvador"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
