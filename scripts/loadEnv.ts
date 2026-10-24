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
 * .env gana sobre .env.local. Si tras cargarlos APP_ENV no es 'qa', el script
 * termina con error: el .env local podría seguir apuntando a producción.
 *
 * Producción es solo por pedido explícito: `--prod` en los argumentos o
 * WELLNEST_ENV=prod; entonces se carga ÚNICAMENTE `.env.prod` (gitignored) y se
 * imprime a stderr un aviso con el host de la base. Si `.env.prod` no existe,
 * el script termina con error. Un `.env.prod` presente sin esa señal nunca se
 * carga. Como Prisma leería luego `.env` (QA) y rellenaría lo que `.env.prod`
 * no definió, toda clave de `.env`/`.env.local`/`prisma/.env` sin definir queda
 * en '' y APP_ENV en 'production' si nadie la fijó.
 *
 * Marca WELLNEST_ENV_LOADED ('prod' | 'qa'): src/lib/prisma.ts se niega a
 * arrancar con WELLNEST_ENV=prod si este módulo no se importó.
 *
 * Precedencia en todos los casos: una variable ya presente en el entorno real
 * gana sobre los archivos. Prisma tampoco pisa variables ya presentes en
 * process.env, así que lo que se cargue aquí es lo que Prisma usa.
 *
 * La lógica de decisión vive en src/lib/envFiles.ts (con tests); aquí solo I/O.
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  resolveEnvFiles,
  parseEnvContent,
  prodShadowAssignments,
  qaTargetError,
  dbHostFromEnv,
  PROD_SHADOWED_FILES,
} from '../src/lib/envFiles'

function readIfExists(file: string): string | null {
  const full = path.resolve(process.cwd(), file)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null
}

export function loadEnvFile(file: string): void {
  const content = readIfExists(file)
  if (content === null) return
  for (const [key, val] of Object.entries(parseEnvContent(content))) {
    if (!(key in process.env)) process.env[key] = val
  }
}

const { files, production } = resolveEnvFiles({
  argv: process.argv,
  wellnestEnv: process.env.WELLNEST_ENV,
})

if (production && readIfExists('.env.prod') === null) {
  console.error('ERROR: se pidió producción (--prod / WELLNEST_ENV=prod) pero no existe .env.prod')
  process.exit(1)
}

for (const file of files) loadEnvFile(file)

if (production) {
  const localContents = PROD_SHADOWED_FILES.map(readIfExists).filter((c): c is string => c !== null)
  Object.assign(process.env, prodShadowAssignments(process.env, localContents))
  process.env.WELLNEST_ENV_LOADED = 'prod'
  console.error(`*** PRODUCCIÓN — base ${dbHostFromEnv(process.env)} ***`)
} else {
  const error = qaTargetError(false, process.env.APP_ENV)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  process.env.WELLNEST_ENV_LOADED = 'qa'
}
