import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { isTransientDbError, withDbRetry } from './retry'

const tooManyConnections = () =>
  new Prisma.PrismaClientInitializationError(
    'Too many database connections opened: FATAL: too many connections for role "prisma_migration"',
    '5.22.0'
  )

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: '5.22.0' })

describe('isTransientDbError', () => {
  it('treats connection-level failures as transient', () => {
    expect(isTransientDbError(tooManyConnections())).toBe(true)
    expect(isTransientDbError(knownError('P2037'))).toBe(true) // too many connections
    expect(isTransientDbError(knownError('P1001'))).toBe(true) // can't reach server
    expect(isTransientDbError(knownError('P2024'))).toBe(true) // pool timeout
  })

  it('does not treat query/business errors as transient', () => {
    expect(isTransientDbError(knownError('P2002'))).toBe(false) // unique violation
    expect(isTransientDbError(new Error('boom'))).toBe(false)
    expect(isTransientDbError('nope')).toBe(false)
  })
})

describe('withDbRetry', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries transient failures until the operation succeeds', async () => {
    vi.useFakeTimers()
    let calls = 0
    const op = async () => {
      calls++
      if (calls < 3) throw tooManyConnections()
      return 'ok'
    }

    const promise = withDbRetry(op, [100, 200, 400])
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe('ok')
    expect(calls).toBe(3)
  })

  it('does not retry non-transient errors', async () => {
    let calls = 0
    const op = async () => {
      calls++
      throw knownError('P2002')
    }

    await expect(withDbRetry(op, [100, 200])).rejects.toMatchObject({ code: 'P2002' })
    expect(calls).toBe(1)
  })

  it('rethrows the last transient error once the delays are exhausted', async () => {
    vi.useFakeTimers()
    let calls = 0
    const op = async () => {
      calls++
      throw tooManyConnections()
    }

    const promise = withDbRetry(op, [100, 200])
    const assertion = expect(promise).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
    await vi.runAllTimersAsync()
    await assertion
    expect(calls).toBe(3) // 1 intento + 2 reintentos
  })
})
