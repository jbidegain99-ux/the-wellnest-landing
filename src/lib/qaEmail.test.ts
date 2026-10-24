import { describe, it, expect } from 'vitest'
import { routeQaEmail } from './qaEmail'

const allowlist = 'jose@x.com, adriana@x.com'
const sink = 'sink@x.com'

describe('routeQaEmail', () => {
  it('todos permitidos', () => {
    expect(routeQaEmail({ to: ['jose@x.com'], subject: 'Hola', sink, allowlist })).toEqual({
      to: ['jose@x.com'],
      subject: '[QA → jose@x.com] Hola',
    })
  })

  it('no permitido va al sink', () => {
    expect(routeQaEmail({ to: ['clienta@gmail.com'], subject: 'Hola', sink, allowlist })).toEqual({
      to: ['sink@x.com'],
      subject: '[QA → clienta@gmail.com] Hola',
    })
  })

  it('mezcla sin duplicar el sink', () => {
    expect(
      routeQaEmail({ to: ['adriana@x.com', 'clienta@gmail.com', 'otra@gmail.com'], subject: 'Hola', sink, allowlist })
    ).toEqual({
      to: ['adriana@x.com', 'sink@x.com'],
      subject: '[QA → adriana@x.com, clienta@gmail.com, otra@gmail.com] Hola',
    })
  })

  it('normaliza mayúsculas y espacios', () => {
    const r = routeQaEmail({ to: [' Adriana@X.com '], subject: 'Hola', sink, allowlist: 'adriana@x.com' })
    expect(r?.to).toEqual(['adriana@x.com'])
  })

  it('sin sink y sin permitidos devuelve null', () => {
    expect(routeQaEmail({ to: ['clienta@gmail.com'], subject: 'Hola', sink: undefined, allowlist })).toBeNull()
  })

  it('sin sink con mezcla deja solo los permitidos', () => {
    const r = routeQaEmail({ to: ['jose@x.com', 'clienta@gmail.com'], subject: 'Hola', sink: undefined, allowlist })
    expect(r?.to).toEqual(['jose@x.com'])
  })

  it('sink vacío no deja salir a no permitidos', () => {
    expect(routeQaEmail({ to: ['clienta@gmail.com'], subject: 'Hola', sink: '', allowlist: '' })).toBeNull()
  })
})
