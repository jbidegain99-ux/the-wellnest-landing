import { describe, it, expect } from 'vitest'
import { resolveEnvFiles, parseEnvContent, prodShadowAssignments, qaTargetError, dbHostFromEnv, prodSignalError } from './envFiles'

describe('resolveEnvFiles', () => {
  it('por defecto QA', () => {
    expect(resolveEnvFiles({ argv: [], wellnestEnv: undefined })).toEqual({
      files: ['.env', '.env.local'],
      production: false,
    })
  })

  it('--prod carga solo .env.prod', () => {
    expect(resolveEnvFiles({ argv: ['node', 'x.ts', '--prod'], wellnestEnv: undefined })).toEqual({
      files: ['.env.prod'],
      production: true,
    })
  })

  it('WELLNEST_ENV=prod carga solo .env.prod', () => {
    expect(resolveEnvFiles({ argv: [], wellnestEnv: 'prod' })).toEqual({
      files: ['.env.prod'],
      production: true,
    })
  })

  it('otro valor no es prod', () => {
    expect(resolveEnvFiles({ argv: [], wellnestEnv: 'production' })).toEqual({
      files: ['.env', '.env.local'],
      production: false,
    })
  })
})

describe('parseEnvContent', () => {
  it('lee claves, quita comillas, ignora comentarios y acepta export', () => {
    const content = [
      '# comentario',
      'DATABASE_URL="postgres://u:p@qa.example:5432/db"',
      "APP_ENV='qa'",
      'export EMAIL_FROM=hola@x.com',
      '',
      'SIN_IGUAL',
      'VACIA=',
    ].join('\n')
    expect(parseEnvContent(content)).toEqual({
      DATABASE_URL: 'postgres://u:p@qa.example:5432/db',
      APP_ENV: 'qa',
      EMAIL_FROM: 'hola@x.com',
      VACIA: '',
    })
  })
})

describe('prodShadowAssignments (I-1: .env de QA no se cuela en modo prod)', () => {
  const dotEnvQa = 'APP_ENV=qa\nDATABASE_URL=postgres://qa\nPAYWAY_ENV=TEST\nQA_EMAIL_SINK=sink@x.com'
  const dotEnvLocal = 'AZURE_CLIENT_ID=abc\nEMAIL_FROM=qa@x.com'

  it('deja en blanco las claves locales que .env.prod no definió y fija APP_ENV=production', () => {
    const env = { DATABASE_URL: 'postgres://prod', EMAIL_FROM: 'prod@x.com' }
    expect(prodShadowAssignments(env, [dotEnvQa, dotEnvLocal])).toEqual({
      APP_ENV: 'production',
      PAYWAY_ENV: '',
      QA_EMAIL_SINK: '',
      AZURE_CLIENT_ID: '',
    })
  })

  it('no toca claves ya definidas (entorno real o .env.prod), aunque estén vacías', () => {
    const env = { APP_ENV: 'production', PAYWAY_ENV: '', DATABASE_URL: 'postgres://prod', QA_EMAIL_SINK: 'x' }
    expect(prodShadowAssignments(env, [dotEnvQa])).toEqual({})
  })

  it('sin archivos locales igual fija APP_ENV=production', () => {
    expect(prodShadowAssignments({}, [])).toEqual({ APP_ENV: 'production' })
  })
})

describe('qaTargetError (I-2: modo por defecto exige APP_ENV=qa)', () => {
  it('modo por defecto con APP_ENV=qa: ok', () => {
    expect(qaTargetError(false, 'qa')).toBeNull()
  })

  it('modo por defecto sin APP_ENV: aborta con instrucciones', () => {
    const msg = qaTargetError(false, undefined)
    expect(msg).toContain('el .env local no es de QA (falta APP_ENV=qa); para producción usa WELLNEST_ENV=prod')
    expect(msg).toContain('APP_ENV=qa')
  })

  it('modo por defecto con APP_ENV=production: aborta', () => {
    expect(qaTargetError(false, 'production')).not.toBeNull()
  })

  it('modo producción no exige APP_ENV=qa', () => {
    expect(qaTargetError(true, undefined)).toBeNull()
    expect(qaTargetError(true, 'production')).toBeNull()
  })
})

describe('dbHostFromEnv (M-1: host que usará Prisma)', () => {
  it('prefiere DATABASE_POOLED_URL', () => {
    expect(
      dbHostFromEnv({
        DATABASE_POOLED_URL: 'postgres://u:p@pooled.db.prisma.io:5432/x?pgbouncer=true',
        DATABASE_URL: 'postgres://u:p@db.prisma.io:5432/x',
        POSTGRES_URL: 'postgres://u:p@otro:5432/x',
      }),
    ).toBe('pooled.db.prisma.io')
  })

  it('luego DATABASE_URL, luego POSTGRES_URL; las vacías no cuentan', () => {
    expect(dbHostFromEnv({ DATABASE_POOLED_URL: '', DATABASE_URL: 'postgres://u:p@db.prisma.io/x', POSTGRES_URL: 'postgres://o/x' })).toBe('db.prisma.io')
    expect(dbHostFromEnv({ DATABASE_URL: '', POSTGRES_URL: 'postgres://u:p@directo.example:5432/x' })).toBe('directo.example')
  })

  it('sin URL o inválida: desconocido, sin filtrar credenciales', () => {
    expect(dbHostFromEnv({})).toBe('(desconocido)')
    expect(dbHostFromEnv({ DATABASE_URL: 'no es url clave123' })).toBe('(desconocido)')
  })
})

describe('prodSignalError (I-3: WELLNEST_ENV=prod sin loadEnv)', () => {
  it('sin WELLNEST_ENV (app en Vercel): null', () => {
    expect(prodSignalError({})).toBeNull()
    expect(prodSignalError({ WELLNEST_ENV_LOADED: 'qa' })).toBeNull()
  })

  it('WELLNEST_ENV=prod y loadEnv cargó prod: null', () => {
    expect(prodSignalError({ WELLNEST_ENV: 'prod', WELLNEST_ENV_LOADED: 'prod' })).toBeNull()
  })

  it('WELLNEST_ENV=prod sin loadEnv: error claro', () => {
    expect(prodSignalError({ WELLNEST_ENV: 'prod' })).toContain('WELLNEST_ENV=prod requiere importar ./loadEnv primero')
    expect(prodSignalError({ WELLNEST_ENV: 'prod', WELLNEST_ENV_LOADED: 'qa' })).not.toBeNull()
  })
})
