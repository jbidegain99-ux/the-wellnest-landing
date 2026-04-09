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
  // Workaround for a known Next.js 14 bug where "Collecting build traces"
  // crashes with a micromatch `RangeError: Maximum call stack size exceeded`.
  // The tracer feeds brace-expanded globs from node_modules to picomatch and
  // blows the regex stack. Excluding the large native-binary dirs and the
  // Prisma/SWC caches from tracing sidesteps the bug without touching the
  // runtime bundle. See: https://github.com/vercel/next.js/issues/42641
  experimental: {
    outputFileTracingRoot: __dirname,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu/**',
        'node_modules/@swc/core-linux-x64-musl/**',
        'node_modules/@esbuild/**',
        'node_modules/terser/**',
        'node_modules/webpack/**',
        'node_modules/@next/swc-linux-x64-gnu/**',
        'node_modules/@next/swc-linux-x64-musl/**',
        'node_modules/@prisma/engines/**',
        'node_modules/prisma/**',
        'node_modules/typescript/**',
        'node_modules/.cache/**',
      ],
    },
  },
}

module.exports = nextConfig