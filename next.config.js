/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow images from any domain (admin can configure external URLs)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig