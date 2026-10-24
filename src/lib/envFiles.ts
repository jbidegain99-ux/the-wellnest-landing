/**
 * Decide qué archivos de entorno cargan los scripts.
 *
 * Por defecto (local) se usan `.env` y `.env.local`, que apuntan a QA.
 * Producción exige una señal explícita: `--prod` en argv o WELLNEST_ENV=prod
 * (valor exacto). En ese caso se carga únicamente `.env.prod`.
 */

export interface EnvFilesInput {
  argv: string[]
  wellnestEnv: string | undefined
}

export interface EnvFilesResult {
  files: string[]
  production: boolean
}

export function resolveEnvFiles(input: EnvFilesInput): EnvFilesResult {
  const production = input.argv.includes('--prod') || input.wellnestEnv === 'prod'
  return production
    ? { files: ['.env.prod'], production: true }
    : { files: ['.env', '.env.local'], production: false }
}
