/**
 * PayWay One (Banco Cuscatlan) integration helpers.
 *
 * SECURITY NOTES:
 * - PAYWAY_TOKEN_ENCRYPT is NEVER exposed to the client.
 * - Encryption happens ONLY on the server.
 * - PAYWAY_TOKEN_AUTH is passed to the client (required by PayWay JS SDK).
 *   Per PayWay documentation, this is a merchant authentication token, not a secret key.
 */

import crypto from 'crypto'

// PayWay environment configuration
export function getPaywayConfig() {
  const env = process.env.PAYWAY_ENV || 'TEST'

  const baseUrl =
    env === 'PROD'
      ? process.env.PAYWAY_BASE_URL_PROD || 'https://payway.sv'
      : process.env.PAYWAY_BASE_URL_TEST || 'https://test.payway.sv'

  const callbackBaseUrl = process.env.PAYWAY_CALLBACK_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || ''

  return {
    env,
    baseUrl,
    scriptUrl: `${baseUrl}/web-payway-sv/resources/js/paywayOneButton.js`,
    tokenAuth: process.env.PAYWAY_TOKEN_AUTH || '',
    tokenEncrypt: process.env.PAYWAY_TOKEN_ENCRYPT || '',
    retailerOwner: process.env.PAYWAY_RETAILER_OWNER || '',
    userOperation: process.env.PAYWAY_USER_OPERATION || '',
    callbackBaseUrl,
  }
}

/**
 * Encrypts a value using AES-256-CBC with the PayWay encryption token.
 * Uses fixed IV "fedcba9876543210" as per PayWay documentation.
 *
 * @param value - The plain text value to encrypt
 * @param encryptionKey - The 32-byte encryption key (PAYWAY_TOKEN_ENCRYPT)
 * @returns Base64 encoded encrypted string
 */
export function encryptPaywayValue(value: string, encryptionKey: string): string {
  // Fixed IV as per PayWay documentation
  const iv = Buffer.from('fedcba9876543210', 'utf8')

  // Ensure key is exactly 32 bytes for AES-256
  const key = Buffer.from(encryptionKey.padEnd(32).slice(0, 32), 'utf8')

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(value, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  return encrypted
}

/**
 * Format amount for PayWay (2 decimal places, e.g., "10.00")
 */
export function formatPaywayAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Generate the PayWay callback URL with orderId as query parameter.
 */
export function generateCallbackUrl(orderId: string, denied: boolean = false): string {
  const config = getPaywayConfig()
  const endpoint = denied ? 'denied' : 'callback'
  return `${config.callbackBaseUrl}/api/payments/payway/${endpoint}?oid=${orderId}`
}

/**
 * Generates the encrypted payload for PayWay init.
 * This is called server-side only.
 */
export interface PaywayInitPayload {
  amountEncrypted: string
  responseCallbackEncrypted: string
  deniedCallbackEncrypted?: string
  serviceProduct: string
  userClient: string
  clientIP: string
  // These are safe to pass to client (merchant identifiers, not secrets)
  tokenAuth: string
  retailerOwner: string
  userOperation: string
}

export function generatePaywayPayload(
  orderId: string,
  amount: number,
  clientIP: string = '127.0.0.1',
  userClient: string = 'anonymous'
): PaywayInitPayload {
  const config = getPaywayConfig()

  if (!config.tokenEncrypt) {
    throw new Error('PAYWAY_TOKEN_ENCRYPT is not configured')
  }

  if (!config.tokenAuth) {
    throw new Error('PAYWAY_TOKEN_AUTH is not configured')
  }

  if (!config.retailerOwner) {
    throw new Error('PAYWAY_RETAILER_OWNER is not configured')
  }

  // Format amount
  const formattedAmount = formatPaywayAmount(amount)

  // Generate callback URLs
  const callbackUrl = generateCallbackUrl(orderId, false)
  const deniedCallbackUrl = generateCallbackUrl(orderId, true)

  // Encrypt sensitive values
  const amountEncrypted = encryptPaywayValue(formattedAmount, config.tokenEncrypt)
  const responseCallbackEncrypted = encryptPaywayValue(callbackUrl, config.tokenEncrypt)
  const deniedCallbackEncrypted = encryptPaywayValue(deniedCallbackUrl, config.tokenEncrypt)

  console.log('[PAYWAY] Generated payload for order:', {
    orderId,
    amount: formattedAmount,
    callbackUrl: callbackUrl.replace(/oid=.*/, 'oid=***'),
    env: config.env,
  })

  return {
    amountEncrypted,
    responseCallbackEncrypted,
    deniedCallbackEncrypted,
    serviceProduct: `wellnest_order_${orderId}`,
    userClient,
    clientIP,
    // Merchant identifiers (safe for client)
    tokenAuth: config.tokenAuth,
    retailerOwner: config.retailerOwner,
    userOperation: config.userOperation,
  }
}

/**
 * Extract and sanitize PayWay callback parameters.
 * Removes any sensitive data before logging/storing.
 */
export interface PaywayCallbackData {
  orderId: string
  authorizationNumber?: string
  referenceNumber?: string
  paywayNumber?: string
  transactionDate?: string
  paymentNumber?: string
  cardBrand?: string
  cardLastDigits?: string
  cardHolder?: string
}

export function parsePaywayCallback(
  queryParams: URLSearchParams,
  body?: Record<string, string>
): PaywayCallbackData | null {
  // Get orderId from query string (oid parameter)
  const orderId = queryParams.get('oid')

  if (!orderId) {
    console.error('[PAYWAY] Callback missing orderId (oid)')
    return null
  }

  // Extract transaction data from body (form data from PayWay)
  const data: PaywayCallbackData = {
    orderId,
    authorizationNumber: body?.pwoAuthorizationNumber,
    referenceNumber: body?.pwoReferenceNumber,
    paywayNumber: body?.pwoPayWayNumber,
    transactionDate: body?.pwoTransactionDate,
    paymentNumber: body?.pwoPaymentNumber,
    cardBrand: body?.pwoCustomerCCBrand,
    cardLastDigits: body?.pwoCustomerCCLastD,
    cardHolder: body?.pwoCustomerName,
  }

  return data
}

/**
 * Create a sanitized version of raw callback payload for logging/storage.
 * Removes any potential sensitive data.
 */
export function sanitizePaywayPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload }

  // Remove any fields that might contain sensitive data
  const sensitiveKeys = ['token', 'key', 'secret', 'password', 'cvv', 'cc', 'card']

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive) && !lowerKey.includes('last'))) {
      sanitized[key] = '[REDACTED]'
    }
  }

  return sanitized
}
