import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface GraphBody {
  message: { subject: string; toRecipients: { emailAddress: { address: string } }[] }
}

describe('sendEmail con desvío de QA', () => {
  const graphBodies: GraphBody[] = []

  beforeEach(() => {
    vi.resetModules()
    graphBodies.length = 0
    vi.stubEnv('EMAIL_FROM', 'from@x.com')
    vi.stubEnv('AZURE_TENANT_ID', 't')
    vi.stubEnv('AZURE_CLIENT_ID', 'c')
    vi.stubEnv('AZURE_CLIENT_SECRET', 's')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { body?: string }) => {
        if (url.includes('login.microsoftonline.com')) {
          return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }), { status: 200 })
        }
        graphBodies.push(JSON.parse(init?.body ?? '{}') as GraphBody)
        return new Response(null, { status: 202 })
      })
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sin APP_ENV envía a los destinatarios y asunto originales', async () => {
    vi.stubEnv('APP_ENV', '')
    const { sendEmail } = await import('./emailService')
    const res = await sendEmail({ to: 'clienta@gmail.com', subject: 'Hola', html: '<p>x</p>' })
    expect(res.success).toBe(true)
    expect(graphBodies).toHaveLength(1)
    expect(graphBodies[0].message.subject).toBe('Hola')
    expect(graphBodies[0].message.toRecipients.map(r => r.emailAddress.address)).toEqual(['clienta@gmail.com'])
  })

  it('con APP_ENV=qa desvía al sink y antepone el prefijo', async () => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('QA_EMAIL_SINK', 'sink@x.com')
    vi.stubEnv('QA_EMAIL_ALLOWLIST', 'jose@x.com')
    const { sendEmail } = await import('./emailService')
    const res = await sendEmail({ to: 'clienta@gmail.com', subject: 'Hola', html: '<p>x</p>' })
    expect(res.success).toBe(true)
    expect(graphBodies[0].message.subject).toBe('[QA → clienta@gmail.com] Hola')
    expect(graphBodies[0].message.toRecipients.map(r => r.emailAddress.address)).toEqual(['sink@x.com'])
  })

  it('con APP_ENV=qa y sin sink descarta sin llamar a Graph', async () => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('QA_EMAIL_SINK', '')
    vi.stubEnv('QA_EMAIL_ALLOWLIST', '')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { sendEmail } = await import('./emailService')
    const res = await sendEmail({ to: 'clienta@gmail.com', subject: 'Hola', html: '<p>x</p>' })
    expect(res).toEqual({ success: true })
    expect(graphBodies).toHaveLength(0)
    expect(log).toHaveBeenCalledWith('[EMAIL][QA] descartado: clienta@gmail.com')
    log.mockRestore()
  })
})
