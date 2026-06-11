/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // El sitio no se embebe en iframes de terceros (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  images: {
    // Solo hosts de imágenes realmente usados — hostname '**' convertía el
    // optimizador de imágenes en un proxy abierto (y facturable) de cualquier
    // URL de internet. Si el admin agrega un nuevo hosting de assets, añadir
    // su hostname aquí.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        // Fallbacks de DEFAULT_ASSETS (lib/assets.ts) cuando el BrandAsset
        // no existe en BD o la consulta falla
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
}

module.exports = nextConfig