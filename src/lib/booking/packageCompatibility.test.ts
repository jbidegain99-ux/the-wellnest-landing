import { describe, it, expect } from 'vitest'
import {
  checkPackageClassCompatibility,
  isPackageCompatibleWithClass,
} from './packageCompatibility'

describe('checkPackageClassCompatibility', () => {
  it('rejects private packages with PRIVATE_ONLY', () => {
    expect(
      checkPackageClassCompatibility({ isPrivate: true, disciplines: [] }, 'yoga')
    ).toBe('PRIVATE_ONLY')
  })

  it('returns OK for a non-private package with no discipline restriction', () => {
    expect(
      checkPackageClassCompatibility({ isPrivate: false, disciplines: [] }, 'yoga')
    ).toBe('OK')
  })

  it('returns OK when the class discipline is in the allowed list', () => {
    expect(
      checkPackageClassCompatibility(
        { isPrivate: false, disciplines: [{ disciplineId: 'yoga' }, { disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe('OK')
  })

  it('returns DISCIPLINE_NOT_COVERED when the class discipline is not allowed', () => {
    expect(
      checkPackageClassCompatibility(
        { isPrivate: false, disciplines: [{ disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe('DISCIPLINE_NOT_COVERED')
  })
})

describe('isPackageCompatibleWithClass', () => {
  it('is true only when compatibility is OK', () => {
    expect(
      isPackageCompatibleWithClass({ isPrivate: false, disciplines: [] }, 'yoga')
    ).toBe(true)
    expect(
      isPackageCompatibleWithClass({ isPrivate: true, disciplines: [] }, 'yoga')
    ).toBe(false)
    expect(
      isPackageCompatibleWithClass(
        { isPrivate: false, disciplines: [{ disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe(false)
  })
})
