import { describe, it, expect } from 'vitest'
import {
  buildWaitlistAssignedEmail,
  buildAdminPrivateSessionNotification,
  buildPrivateSessionConfirmationEmail,
} from './emailService'

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

describe('buildAdminPrivateSessionNotification', () => {
  const slot1 = new Date('2026-06-01T18:00:00.000Z')
  const slot2 = new Date('2026-06-03T18:00:00.000Z')
  const slot3 = new Date('2026-06-05T18:00:00.000Z')
  const baseData = {
    userName: 'María',
    userEmail: 'maria@example.com',
    disciplineName: 'Yoga',
    instructorName: 'Valeria',
    slot1,
    slot2,
    slot3,
    notes: null,
    requestId: 'req_123',
  }

  it('renders the 3 sessions with "Sesión N" labels', () => {
    const html = buildAdminPrivateSessionNotification(baseData)
    expect(html).toContain('Sesi&oacute;n 1')
    expect(html).toContain('Sesi&oacute;n 2')
    expect(html).toContain('Sesi&oacute;n 3')
  })

  it('does not use the old "Opción N" wording', () => {
    const html = buildAdminPrivateSessionNotification(baseData)
    expect(html).not.toContain('Opci&oacute;n 1')
    expect(html).not.toContain('Ventanas')
  })

  it('falls back to legacy single-slot rendering when slot2/slot3 are null', () => {
    const html = buildAdminPrivateSessionNotification({
      ...baseData,
      slot2: null,
      slot3: null,
    })
    expect(html).toContain('Sesi&oacute;n 1')
    expect(html).not.toContain('Sesi&oacute;n 2')
  })
})

describe('buildPrivateSessionConfirmationEmail', () => {
  const baseData = {
    userName: 'María',
    sessions: [
      { dateTime: 'lun, 1 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
      { dateTime: 'mié, 3 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
      { dateTime: 'vie, 5 jun 2026, 6:00 p.m.', disciplineName: 'Yoga', instructorName: 'Valeria', duration: 60 },
    ],
  }

  it('renders all 3 session dates', () => {
    const html = buildPrivateSessionConfirmationEmail(baseData)
    expect(html).toContain('lun, 1 jun 2026')
    expect(html).toContain('mié, 3 jun 2026')
    expect(html).toContain('vie, 5 jun 2026')
  })

  it('greets by name when provided', () => {
    const html = buildPrivateSessionConfirmationEmail(baseData)
    expect(html).toContain('Hola María')
  })

  it('falls back to plain greeting when name is null', () => {
    const html = buildPrivateSessionConfirmationEmail({ ...baseData, userName: null })
    expect(html).toMatch(/Hola[^<]*<\/p>/)
    expect(html).not.toContain('Hola null')
  })
})
