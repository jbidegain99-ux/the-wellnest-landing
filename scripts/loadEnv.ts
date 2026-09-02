/**
 * Carga .env y .env.local en process.env para scripts corridos con tsx.
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
 * Precedencia: .env gana sobre .env.local, y una variable ya presente en el
 * entorno real gana sobre ambos.
 */

import * as fs from 'fs'
import * as path from 'path'

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

loadEnvFile(path.resolve(process.cwd(), '.env'))
loadEnvFile(path.resolve(process.cwd(), '.env.local'))
