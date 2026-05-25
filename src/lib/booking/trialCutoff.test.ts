import { describe, it, expect } from 'vitest'
import { TRIAL_PACKAGE_ID, TRIAL_CUTOFF_UTC, isTrialBlockedForClass } from './trialCutoff'

describe('isTrialBlockedForClass', () => {
  const beforeCutoff = new Date(TRIAL_CUTOFF_UTC.getTime() - 1000)
  const afterCutoff = new Date(TRIAL_CUTOFF_UTC.getTime() + 1000)

  it('blocks the trial package for a class at/after the cutoff', () => {
    expect(isTrialBlockedForClass(TRIAL_PACKAGE_ID, afterCutoff)).toBe(true)
    expect(isTrialBlockedForClass(TRIAL_PACKAGE_ID, TRIAL_CUTOFF_UTC)).toBe(true)
  })

  it('allows the trial package for a class before the cutoff', () => {
    expect(isTrialBlockedForClass(TRIAL_PACKAGE_ID, beforeCutoff)).toBe(false)
  })

  it('never blocks a non-trial package', () => {
    expect(isTrialBlockedForClass('some-other-package', afterCutoff)).toBe(false)
  })
})
