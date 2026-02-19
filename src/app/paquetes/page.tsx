import { prisma } from '@/lib/prisma'
import { PackagesGrid } from './PackagesGrid'

export const metadata = {
  title: 'Paquetes de Clases | Wellnest',
  description:
    'Descubre nuestros paquetes de clases flexibles. Usa tus clases en cualquier disciplina: Yoga, Mat Pilates, Pole Fitness, Terapia de Sonido.',
}

// Force dynamic rendering - always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const packageColors = [
  'from-[#E8E0D4] to-[#F5F0E8]',
  'from-[#C4A77D] to-[#E8E0D4]',
  'from-[#9CAF88] to-[#C4A77D]',
  'from-[#8B7355] to-[#9CAF88]',
  'from-[#6B7F5E] to-[#8B7355]',
  'from-[#9CAF88] to-[#6B7F5E]',
  'from-[#6A6F4C] to-[#806044]',
]

async function getPackages() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      subtitle: true,
      shortDescription: true,
      fullDescription: true,
      classCount: true,
      price: true,
      currency: true,
      validityDays: true,
      validityText: true,
      bulletsTop: true,
      bulletsBottom: true,
      originalPrice: true,
      discountPercent: true,
      isFeatured: true,
    },
  })
  return packages
}

export default async function PaquetesPage() {
  const packages = await getPackages()

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-foreground mb-6">
            Paquetes de Clases Wellnest
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Elige el paquete que mejor se adapte a ti. Recuerda: puedes usar tus
            clases en <span className="text-primary font-medium">cualquier disciplina</span>.
          </p>
        </div>
      </section>

      {/* Packages Grid - Client Component for interactivity */}
      <PackagesGrid packages={packages} colors={packageColors} />

      {/* Info note */}
      <section className="pb-12 sm:pb-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 bg-white rounded-2xl border border-beige">
            <h3 className="text-xl font-medium text-foreground mb-4">
              ¿Cómo funcionan los paquetes?
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  <strong className="font-medium">Flexibilidad total:</strong> Usa tus clases en cualquier
                  disciplina (Yoga, Mat Pilates, Pole Fitness, Terapia de Sonido).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  <strong className="font-medium">Vigencia clara:</strong> Cada paquete tiene una vigencia
                  específica desde la fecha de compra.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  <strong className="font-medium">Fácil de usar:</strong> Reserva desde tu perfil y presenta
                  tu código QR al llegar al estudio.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  <strong className="font-medium">Nota:</strong> Las consultas de nutrición requieren pago
                  adicional y no están incluidas en los paquetes de clases.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
