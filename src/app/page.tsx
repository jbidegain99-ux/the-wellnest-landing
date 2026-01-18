import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Leaf, Heart, Sparkles, Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DisciplinesCarousel } from '@/components/home/DisciplinesCarousel'
import { getBrandAssets } from '@/lib/assets'

// Force dynamic rendering - never cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

const benefits = [
  {
    icon: Leaf,
    title: 'Paquetes Flexibles',
    description: 'Usa tus clases en cualquier disciplina según tu estado de ánimo.',
    image: '/images/values/flexibilidad.svg',
  },
  {
    icon: Heart,
    title: 'Bienestar Integral',
    description: 'Múltiples disciplinas en un solo lugar para tu cuerpo, mente y espíritu.',
    image: '/images/values/bienestar.svg',
  },
  {
    icon: Sparkles,
    title: 'Experiencia Premium',
    description: 'Un espacio diseñado para tu comodidad y relajación total.',
    image: '/images/values/premium.svg',
  },
  {
    icon: Users,
    title: 'Comunidad Acogedora',
    description: 'Únete a una comunidad que te apoya en tu viaje de bienestar.',
    image: '/images/values/comunidad.svg',
  },
]

export default async function HomePage() {
  // Load brand assets from database
  const assets = await getBrandAssets()
  const heroVideoUrl = assets.hero_video_url?.url || 'https://videos.pexels.com/video-files/5123881/5123881-hd_1280_720_25fps.mp4'

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Video - Loaded from Brand Assets */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute w-full h-full object-cover"
          >
            {/* Hero video from Brand Assets (configurable in admin) */}
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
          {/* Fallback gradient for when video doesn't load */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6B7F5E] via-[#8B7355] to-[#C4A77D] -z-10" />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
          {/* Logo */}
          <h1 className="font-logo text-6xl md:text-8xl lg:text-9xl font-normal tracking-[0.1em] mb-6 animate-fade-in">
            wellnest.
          </h1>

          {/* Tagline */}
          <p className="text-base md:text-lg font-medium tracking-[0.3em] uppercase text-white/80 mb-4 animate-fade-in">
            The Soul Hub
          </p>

          {/* Slogan */}
          <p className="text-xl md:text-2xl text-white/90 mb-6 max-w-2xl mx-auto animate-slide-up font-light">
            Donde cuerpo, mente y energía se reencuentran.
          </p>

          {/* Disciplines */}
          <p className="text-sm md:text-base tracking-[0.15em] text-white/70 mb-10 animate-slide-up">
            MAT PILATES &nbsp;|&nbsp; YOGA &nbsp;|&nbsp; POLE &nbsp;|&nbsp; SOUND BATH &nbsp;|&nbsp; NUTRITION
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

      {/* Disciplines Section - Carousel with Hover Reveal */}
      <DisciplinesCarousel assets={assets} />

      {/* Why Choose Us Section */}
      <section className="py-24 bg-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4">
              ¿Por Qué Elegirnos?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              En Wellnest creemos que el bienestar es una elección consciente para cada persona.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div
                  key={benefit.title}
                  className="flex gap-4 p-6 rounded-2xl bg-white/50 backdrop-blur-sm hover:bg-white/70 transition-colors"
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-primary" />
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
                Wellnest está diseñado para ser tu equilibrio en medio de la ciudad.
                Un espacio único y acogedor para conectar y cuidar tu bienestar.
              </p>
              <div className="space-y-4 text-gray-600">
                <p className="flex items-center gap-2">
                  <span className="font-medium">Dirección:</span>
                  Presidente Plaza, Colonia San Benito, San Salvador, El Salvador
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">Horario:</span>
                  Lunes a Sábado, 6:00 AM - 8:00 PM
                </p>
              </div>
              <div className="mt-8 flex gap-4">
                <Link href="/contacto">
                  <Button>
                    Cómo llegar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a
                  href="https://www.google.com/maps/place/Presidente+Plaza,+San+Benito,+San+Salvador,+El+Salvador"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline">
                    Abrir en Google Maps
                  </Button>
                </a>
              </div>
            </div>
            <div className="relative h-80 lg:h-96 rounded-2xl overflow-hidden bg-beige-dark">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3876.4!2d-89.2391!3d13.6928!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f6330c08f9f7b63%3A0x4a0c7c0a0c0a0c0a!2sPresidente%20Plaza%2C%20San%20Benito%2C%20San%20Salvador!5e0!3m2!1ses!2ssv!4v1700000000000"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación The Wellnest - Presidente Plaza, San Benito, San Salvador"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
