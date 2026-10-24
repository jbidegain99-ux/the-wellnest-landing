/**
 * Lógica pura del entorno de los scripts (scripts/loadEnv.ts solo hace I/O).
 *
 * Por defecto (local) se usan `.env` y `.env.local`, que apuntan a QA.
 * Producción exige una señal explícita: `--prod` en argv o WELLNEST_ENV=prod
 * (valor exacto). En ese caso se carga únicamente `.env.prod`.
 *
 * Sin imports de Node: src/lib/prisma.ts importa prodSignalError.
 */

export type EnvMap = Record<string, string | undefined>

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

/**
 * Parsea el contenido de un archivo .env (KEY=valor, comillas simples o dobles,
 * prefijo `export ` opcional, comentarios con #). Sin valores multilínea.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of content.split('\n')) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice('export '.length).trim()
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

/**
 * Archivos que Prisma (u otra librería) podría leer por su cuenta en modo
 * producción. Prisma carga `.env` (y `prisma/.env`) con dotenv sin override:
 * rellena toda clave que `.env.prod` no definió, con valores de QA.
 */
export const PROD_SHADOWED_FILES = ['.env', '.env.local', 'prisma/.env']

/**
 * En modo producción: qué asignar en process.env para que ningún valor de los
 * archivos locales (QA) se cuele. Toda clave de esos archivos que aún no esté
 * definida queda en '' (dotenv no pisa claves presentes, aunque estén vacías),
 * y APP_ENV queda en 'production' si nadie la definió — así isQa() es false
 * aunque `.env` diga APP_ENV=qa.
 */
export function prodShadowAssignments(env: EnvMap, otherFileContents: string[]): Record<string, string> {
  const assignments: Record<string, string> = {}
  for (const content of otherFileContents) {
    for (const key of Object.keys(parseEnvContent(content))) {
      if (env[key] === undefined) assignments[key] = ''
    }
  }
  if (env.APP_ENV === undefined) assignments.APP_ENV = 'production'
  return assignments
}

/**
 * En modo por defecto el destino debe ser QA: sin APP_ENV=qa el `.env` local
 * podría seguir apuntando a producción. Devuelve el mensaje de error o null.
 */
export function qaTargetError(production: boolean, appEnv: string | undefined): string | null {
  if (production || appEnv === 'qa') return null
  return [
    'ERROR: el .env local no es de QA (falta APP_ENV=qa); para producción usa WELLNEST_ENV=prod.',
    '  - Si tu .env ya apunta a la base de QA: agrégale la línea APP_ENV=qa.',
    '  - Si tu .env todavía apunta a producción: muévelo a .env.prod (con APP_ENV=production),',
    '    arma el .env de QA (ver docs/flujo-ramas-deploy.md) y mientras tanto corre con WELLNEST_ENV=prod.',
  ].join('\n')
}

/**
 * Solo el host de la base que usará Prisma (src/lib/prisma.ts usa
 * DATABASE_POOLED_URL si existe, si no DATABASE_URL); POSTGRES_URL de respaldo.
 * Nunca usuario, clave, ruta ni query.
 */
export function dbHostFromEnv(env: EnvMap): string {
  const raw = env.DATABASE_POOLED_URL || env.DATABASE_URL || env.POSTGRES_URL
  if (!raw) return '(desconocido)'
  try {
    return new URL(raw).hostname || '(desconocido)'
  } catch {
    return '(desconocido)'
  }
}

/**
 * WELLNEST_ENV=prod solo tiene efecto si el script importó scripts/loadEnv
 * (que marca WELLNEST_ENV_LOADED). Sin eso, Prisma leería `.env` (QA) en
 * silencio. Sin WELLNEST_ENV (la app en Vercel) siempre devuelve null.
 */
export function prodSignalError(env: EnvMap): string | null {
  if (env.WELLNEST_ENV !== 'prod') return null
  if (env.WELLNEST_ENV_LOADED === 'prod') return null
  return "WELLNEST_ENV=prod requiere importar ./loadEnv primero (import './loadEnv' como primera línea del script); sin eso Prisma usaría el .env local"
}
