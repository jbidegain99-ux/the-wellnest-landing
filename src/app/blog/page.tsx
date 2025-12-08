import Link from 'next/link'
import { Calendar, ArrowRight, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

// Sample blog posts
const blogPosts = [
  {
    id: '1',
    title: '5 Beneficios del Yoga para tu Vida Diaria',
    slug: '5-beneficios-del-yoga',
    excerpt:
      'Descubre cómo una práctica regular de yoga puede transformar no solo tu cuerpo, sino también tu mente y tu calidad de vida en general.',
    coverImage: '/images/blog/yoga-benefits.jpg',
    category: 'Yoga',
    tags: ['yoga', 'bienestar', 'salud mental'],
    publishedAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Pilates Mat vs Pilates Reformer: ¿Cuál es mejor?',
    slug: 'pilates-mat-vs-reformer',
    excerpt:
      'Una guía completa para entender las diferencias entre estas dos modalidades de Pilates y cuál puede ser más adecuada para tus objetivos.',
    coverImage: '/images/blog/pilates-comparison.jpg',
    category: 'Pilates',
    tags: ['pilates', 'ejercicio', 'fitness'],
    publishedAt: '2024-01-10',
  },
  {
    id: '3',
    title: 'Sound Healing: La Ciencia Detrás de la Sanación con Sonido',
    slug: 'sound-healing-ciencia',
    excerpt:
      'Exploramos la investigación científica que respalda los beneficios del Sound Healing y cómo las frecuencias afectan nuestro cuerpo.',
    coverImage: '/images/blog/sound-healing.jpg',
    category: 'Sound Healing',
    tags: ['sound healing', 'meditación', 'relajación'],
    publishedAt: '2024-01-05',
  },
  {
    id: '4',
    title: 'Guía para Principiantes en Pole Sport',
    slug: 'guia-principiantes-pole',
    excerpt:
      'Todo lo que necesitas saber antes de tu primera clase de Pole Sport: qué esperar, cómo prepararte y por qué es más que solo un ejercicio.',
    coverImage: '/images/blog/pole-beginners.jpg',
    category: 'Pole Sport',
    tags: ['pole sport', 'principiantes', 'empoderamiento'],
    publishedAt: '2024-01-01',
  },
  {
    id: '5',
    title: 'Alimentación Consciente: Más que una Dieta',
    slug: 'alimentacion-consciente',
    excerpt:
      'Aprende a desarrollar una relación más saludable con la comida a través de la alimentación consciente o mindful eating.',
    coverImage: '/images/blog/mindful-eating.jpg',
    category: 'Nutrición',
    tags: ['nutrición', 'mindfulness', 'bienestar'],
    publishedAt: '2023-12-28',
  },
  {
    id: '6',
    title: 'Cómo Mantener una Práctica Constante de Bienestar',
    slug: 'practica-constante-bienestar',
    excerpt:
      'Consejos prácticos para crear y mantener hábitos de bienestar que perduren en el tiempo, incluso con una agenda ocupada.',
    coverImage: '/images/blog/wellness-habits.jpg',
    category: 'Bienestar',
    tags: ['hábitos', 'bienestar', 'motivación'],
    publishedAt: '2023-12-20',
  },
]

const categories = [
  'Todos',
  'Yoga',
  'Pilates',
  'Pole Sport',
  'Sound Healing',
  'Nutrición',
  'Bienestar',
]

export const metadata = {
  title: 'Blog | The Wellnest',
  description:
    'Artículos sobre bienestar, yoga, pilates, nutrición y más. Consejos y guías para tu viaje de bienestar.',
}

export default function BlogPage() {
  const featuredPost = blogPosts[0]
  const otherPosts = blogPosts.slice(1)

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Blog
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Artículos, consejos y guías para acompañarte en tu viaje de bienestar
            integral.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-cream border-b border-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={category === 'Todos' ? 'default' : 'ghost'}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/blog/${featuredPost.slug}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="relative h-64 lg:h-auto min-h-[300px] bg-gradient-to-br from-primary to-primary-600">
                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                  Imagen destacada
                </div>
              </div>

              {/* Content */}
              <div className="p-8 lg:p-12 flex flex-col justify-center">
                <Badge variant="default" className="w-fit mb-4">
                  {featuredPost.category}
                </Badge>
                <h2 className="font-serif text-3xl md:text-4xl font-semibold text-foreground mb-4 group-hover:text-primary transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 text-lg mb-6">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(featuredPost.publishedAt)}
                  </span>
                </div>
                <Button className="w-fit">
                  Leer artículo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Other Posts Grid */}
      <section className="py-16 bg-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1 duration-300 h-full flex flex-col">
                  {/* Image placeholder */}
                  <div className="h-48 bg-gradient-to-br from-beige-dark to-earthTone relative">
                    <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                      {post.category}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <Badge variant="secondary" className="w-fit mb-3">
                      {post.category}
                    </Badge>
                    <h3 className="font-serif text-xl font-semibold text-foreground mb-3 hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.publishedAt)}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {/* Load more */}
          <div className="text-center mt-12">
            <Button variant="outline">Cargar más artículos</Button>
          </div>
        </div>
      </section>

    </>
  )
}
