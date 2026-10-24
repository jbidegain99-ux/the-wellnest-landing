import type { MetadataRoute } from 'next'
import { isQa } from '@/lib/appEnv'

// En QA nadie indexa nada. Fuera de QA, lo mismo que sin robots.txt: todo permitido.
export default function robots(): MetadataRoute.Robots {
  if (isQa()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return { rules: { userAgent: '*', allow: '/' } }
}
