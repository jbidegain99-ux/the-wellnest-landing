import { describe, it, expect } from 'vitest'
import { buildWaitlistAssignedEmail } from './emailService'

describe('buildWaitlistAssignedEmail', () => {
  const baseData = {
    userName: 'María',
    disciplineName: 'Yoga',
    instructorName: 'Valeria Cortez',
    dateTime: 'mié, 7 may 2026, 6:30 p.m.',
    duration: 60,
    packageName: 'Paquete 8 clases',
    classesRemaining: 5,
    profileUrl: 'https://wellneststudio.net/perfil/reservas',
  }

  it('renders the assignment headline', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Se liber')
    expect(html).toContain('un cupo')
  })

  it('greets the user by name when provided', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Hola María')
  })

  it('falls back to plain greeting when name is null', () => {
    const html = buildWaitlistAssignedEmail({ ...baseData, userName: null })
    expect(html).toMatch(/Hola[^<]*<\/p>/)
    expect(html).not.toContain('Hola null')
  })

  it('includes class details', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Yoga')
    expect(html).toContain('Valeria Cortez')
    expect(html).toContain('mié, 7 may 2026, 6:30 p.m.')
    expect(html).toContain('60 minutos')
  })

  it('shows the deducted package and remaining classes', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Paquete 8 clases')
    expect(html).toContain('5')
  })

  it('includes the CTA button to /perfil/reservas', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('https://wellneststudio.net/perfil/reservas')
    expect(html).toContain('Ver mis reservas')
  })

  it('mentions cancellation policy in the footer', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('4 horas')
  })
})
