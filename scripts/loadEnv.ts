/**
 * Carga los archivos de entorno en process.env para scripts corridos con tsx.
 *
 * Por qué existe: tsx no carga archivos .env. Prisma sí lee `.env` por su
 * cuenta, así que la BD conecta sola y es fácil creer que el entorno está
 * completo — pero `.env.local` (donde viven AZURE_*, EMAIL_FROM y SMTP_*) no lo
 * lee nadie, y el envío de correos falla recién al intentar mandar.
 *
 * Importar este módulo ANTES que cualquier otro que lea process.env en el nivel
 * superior (emailService lee EMAIL_FROM al cargarse). En ESM los imports se
 * evalúan en orden de declaración, así que va de primero; los módulos que
 * dependan del entorno se importan dinámicamente dentro de main().
 *
 * Por defecto (local) se cargan `.env` y `.env.local`, que apuntan a QA. Aquí
 * .env gana sobre .env.local. Producción es solo por pedido explícito: `--prod`
 * en los argumentos o WELLNEST_ENV=prod; entonces se carga ÚNICAMENTE
 * `.env.prod` (gitignored) y se imprime a stderr un aviso con el host de la
 * base. Si `.env.prod` no existe, el script termina con error. Un `.env.prod`
 * presente sin esa señal nunca se carga.
 *
 * Precedencia en todos los casos: una variable ya presente en el entorno real
 * gana sobre los archivos. Prisma tampoco pisa variables ya presentes en
 * process.env, así que lo que se cargue aquí es lo que Prisma usa.
 */

import * as fs from 'fs'
import * as path from 'path'
import { resolveEnvFiles } from '../src/lib/envFiles'

export function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

/** Solo el host de la base; nunca usuario, clave, ruta ni query. */
function dbHost(): string {
  const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!raw) return '(desconocido)'
  try {
    return new URL(raw).hostname || '(desconocido)'
  } catch {
    return '(desconocido)'
  }
}

const { files, production } = resolveEnvFiles({
  argv: process.argv,
  wellnestEnv: process.env.WELLNEST_ENV,
})

if (production && !fs.existsSync(path.resolve(process.cwd(), '.env.prod'))) {
  console.error('ERROR: se pidió producción (--prod / WELLNEST_ENV=prod) pero no existe .env.prod')
  process.exit(1)
}

for (const file of files) loadEnvFile(path.resolve(process.cwd(), file))

if (production) {
  console.error(`*** PRODUCCIÓN — base ${dbHost()} ***`)
}
