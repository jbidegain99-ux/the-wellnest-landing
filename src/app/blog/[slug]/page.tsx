import Link from 'next/link'
import { ArrowLeft, Calendar, User, Tag, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

// This would come from database
const getPostBySlug = (slug: string) => {
  return {
    id: '1',
    title: '5 Beneficios del Yoga para tu Vida Diaria',
    slug: '5-beneficios-del-yoga',
    content: `
      <p>El yoga es mucho más que una práctica física. Es una disciplina milenaria que integra cuerpo, mente y espíritu, ofreciendo beneficios que se extienden a todas las áreas de nuestra vida.</p>

      <h2>1. Reduce el Estrés y la Ansiedad</h2>
      <p>La combinación de posturas físicas, técnicas de respiración y meditación que ofrece el yoga actúa directamente sobre nuestro sistema nervioso. Estudios han demostrado que una práctica regular de yoga puede reducir significativamente los niveles de cortisol, la hormona del estrés.</p>

      <h2>2. Mejora la Flexibilidad y Fuerza</h2>
      <p>A través de las asanas o posturas de yoga, trabajamos gradualmente en aumentar nuestra flexibilidad mientras fortalecemos los músculos. Esto no solo mejora nuestra postura, sino que también previene lesiones y dolores crónicos.</p>

      <h2>3. Aumenta la Concentración</h2>
      <p>La práctica del yoga requiere presencia mental y enfoque. Con el tiempo, esta habilidad de concentración se traslada a otras áreas de nuestra vida, mejorando nuestra productividad y claridad mental.</p>

      <h2>4. Mejora la Calidad del Sueño</h2>
      <p>El yoga, especialmente las prácticas más suaves como el yoga restaurativo o el yin yoga, prepara al cuerpo y la mente para un descanso reparador. La regulación del sistema nervioso facilita conciliar el sueño y mejorar su calidad.</p>

      <h2>5. Fomenta la Conexión Mente-Cuerpo</h2>
      <p>Quizás uno de los beneficios más profundos del yoga es la reconexión con nuestro propio cuerpo. En un mundo donde vivimos constantemente en nuestra mente, el yoga nos invita a habitar nuestro cuerpo, escucharlo y respetarlo.</p>

      <h2>Comienza tu Práctica</h2>
      <p>No necesitas ser flexible ni tener experiencia previa para empezar a practicar yoga. Lo único que necesitas es la disposición de dedicarte unos minutos a ti mismo. Te invitamos a conocer nuestras clases de yoga y encontrar la que mejor se adapte a ti.</p>
    `,
    excerpt:
      'Descubre cómo una práctica regular de yoga puede transformar no solo tu cuerpo, sino también tu mente y tu calidad de vida en general.',
    coverImage: '/images/blog/yoga-benefits.jpg',
    category: 'Yoga',
    tags: ['yoga', 'bienestar', 'salud mental'],
    author: 'María García',
    publishedAt: '2024-01-15',
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  return {
    title: `${post.title} | Blog | The Wellnest`,
    description: post.excerpt,
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)

  return (
    <>
      {/* Header */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al blog
          </Link>

          <Badge variant="default" className="mb-4">
            {post.category}
          </Badge>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-600">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(post.publishedAt)}
            </span>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      <section className="bg-cream">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden bg-gradient-to-br from-primary to-primary-600">
            <div className="absolute inset-0 flex items-center justify-center text-white/50">
              Imagen del artículo
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-4">
          <article
            className="prose prose-lg prose-headings:font-serif prose-headings:text-foreground prose-p:text-gray-600 prose-a:text-primary max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-beige">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500" />
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Share */}
          <div className="mt-8 flex items-center gap-4">
            <span className="text-gray-600">Compartir:</span>
            <button className="p-2 rounded-full hover:bg-beige transition-colors">
              <Share2 className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-beige">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl font-semibold text-foreground mb-4">
            ¿Lista para comenzar tu práctica?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Únete a nuestra comunidad y experimenta los beneficios del bienestar
            integral en The Wellnest.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/paquetes">
              <Button>Ver Paquetes</Button>
            </Link>
            <Link href="/horarios">
              <Button variant="outline">Ver Horarios</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
