import { describe, it, expect, afterEach } from 'vitest'
import { siteUrl } from './config'

const original = process.env.NEXTAUTH_URL

describe('siteUrl', () => {
  afterEach(() => { process.env.NEXTAUTH_URL = original })
  it('limpia el salto de línea que trae NEXTAUTH_URL en Vercel', () => {
    process.env.NEXTAUTH_URL = 'https://wellneststudio.net\n'
    expect(siteUrl()).toBe('https://wellneststudio.net')
  })
  it('quita espacios y la barra final', () => {
    process.env.NEXTAUTH_URL = '  https://wellneststudio.net/ \r\n'
    expect(siteUrl()).toBe('https://wellneststudio.net')
  })
  it('vacía → dominio de producción', () => {
    process.env.NEXTAUTH_URL = ' \n'
    expect(siteUrl()).toBe('https://wellneststudio.net')
  })
})
