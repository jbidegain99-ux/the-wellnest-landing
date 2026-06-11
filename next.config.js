/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
}

module.exports = nextConfig