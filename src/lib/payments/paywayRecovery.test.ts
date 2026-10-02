import { describe, it, expect } from 'vitest'
import { pickRecoveryPayload, recoveryTransactionData } from './paywayRecovery'

// Form data real de PayWay (callback de Matilde, 2026-10-01)
const formData: Record<string, string> = {
  oid: 'cmuqc53wv0009xdc9igar48ne',
  sig: '203fb895a87d97604a5fdac9af4af5c36a6f818c131e5e59b208118fcdee6e1d',
  pwoAuthorizationNumber: '211163',
  pwoReferenceNumber: '627420000656',
  pwoPayWayNumber: '5323215156',
  pwoTransactionDate: '20261001202110',
  pwoCustomerCCBrand: 'VISA',
  pwoCustomerCCLastD: 'X-0061',
  pwoCustomerCCHolder: 'GLADYS DELGADO',
  pwoPaymentNumber: '7313740',
}

describe('pickRecoveryPayload', () => {
  it('keeps only the fields needed to credit the order, dropping holder name and signature', () => {
    expect(pickRecoveryPayload(formData)).toEqual({
      oid: 'cmuqc53wv0009xdc9igar48ne',
      pwoAuthorizationNumber: '211163',
      pwoReferenceNumber: '627420000656',
      pwoPayWayNumber: '5323215156',
      pwoTransactionDate: '20261001202110',
      pwoPaymentNumber: '7313740',
      pwoCustomerCCBrand: 'VISA',
      pwoCustomerCCLastD: 'X-0061',
    })
  })

  it('omits fields PayWay did not send', () => {
    expect(pickRecoveryPayload({ oid: 'o1', pwoAuthorizationNumber: '1' })).toEqual({
      oid: 'o1',
      pwoAuthorizationNumber: '1',
    })
  })
})

describe('recoveryTransactionData', () => {
  it('maps the payload to the transaction fields markOrderPaid stores', () => {
    expect(recoveryTransactionData(pickRecoveryPayload(formData))).toEqual({
      authorizationNumber: '211163',
      referenceNumber: '627420000656',
      paywayNumber: '5323215156',
      transactionDate: '20261001202110',
      paymentNumber: '7313740',
      cardBrand: 'VISA',
      cardLastDigits: 'X-0061',
    })
  })
})
