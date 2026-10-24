import { describe, it, expect } from 'vitest'
import { resolveEnvFiles } from './envFiles'

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
