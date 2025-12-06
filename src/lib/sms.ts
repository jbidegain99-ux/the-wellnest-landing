/**
 * SMS Service using Twilio
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID: Twilio account SID
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_PHONE_NUMBER: Twilio phone number to send SMS from
 *
 * For testing, set TWILIO_TEST_MODE=true to log instead of sending
 */

import { prisma } from './prisma'

interface SendSmsParams {
  to: string
  message: string
  userId: string
  reservationId?: string
  type: 'RESERVATION_CONFIRMATION' | 'RESERVATION_REMINDER' | 'RESERVATION_CANCELLED' | 'PACKAGE_EXPIRING' | 'PROMOTIONAL'
}

interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Format phone number to E.164 format for El Salvador
 * El Salvador country code is +503
 */
function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If it's already in international format (starts with country code)
  if (digits.startsWith('503') && digits.length === 11) {
    return `+${digits}`
  }

  // If it's a local El Salvador number (8 digits)
  if (digits.length === 8) {
    return `+503${digits}`
  }

  // If it starts with 503 but already includes the +
  if (phone.startsWith('+503')) {
    return phone
  }

  // Default: assume it needs country code
  return `+503${digits}`
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone)
  // El Salvador numbers should be +503 followed by 8 digits
  return /^\+503\d{8}$/.test(formatted)
}

/**
 * Send SMS via Twilio
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const { to, message, userId, reservationId, type } = params

  console.log('[SMS SERVICE] Sending SMS:', {
    to,
    type,
    userId,
    reservationId,
    messageLength: message.length,
  })

  // Validate phone number
  if (!isValidPhoneNumber(to)) {
    console.error('[SMS SERVICE] Invalid phone number:', to)

    // Log the failed attempt
    await prisma.smsNotification.create({
      data: {
        userId,
        reservationId,
        phoneNumber: to,
        message,
        type,
        status: 'FAILED',
        errorMessage: 'Invalid phone number format',
      },
    })

    return {
      success: false,
      error: 'Invalid phone number format',
    }
  }

  const formattedPhone = formatPhoneNumber(to)

  // Create notification record
  const notification = await prisma.smsNotification.create({
    data: {
      userId,
      reservationId,
      phoneNumber: formattedPhone,
      message,
      type,
      status: 'PENDING',
    },
  })

  // Check if we're in test mode
  const isTestMode = process.env.TWILIO_TEST_MODE === 'true'

  if (isTestMode) {
    console.log('[SMS SERVICE] TEST MODE - Would send SMS:', {
      to: formattedPhone,
      message,
    })

    // Update notification as "sent" in test mode
    await prisma.smsNotification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        twilioSid: `test-${notification.id}`,
      },
    })

    return {
      success: true,
      messageId: `test-${notification.id}`,
    }
  }

  // Check for Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[SMS SERVICE] Missing Twilio credentials')

    await prisma.smsNotification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Missing Twilio credentials',
      },
    })

    return {
      success: false,
      error: 'SMS service not configured',
    }
  }

  try {
    // Make API call to Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: formattedPhone,
        Body: message,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[SMS SERVICE] Twilio error:', result)

      await prisma.smsNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          errorMessage: result.message || 'Twilio API error',
        },
      })

      return {
        success: false,
        error: result.message || 'Failed to send SMS',
      }
    }

    console.log('[SMS SERVICE] SMS sent successfully:', result.sid)

    // Update notification with success
    await prisma.smsNotification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        twilioSid: result.sid,
      },
    })

    return {
      success: true,
      messageId: result.sid,
    }
  } catch (error: any) {
    console.error('[SMS SERVICE] Error sending SMS:', error)

    await prisma.smsNotification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        errorMessage: error?.message || 'Unknown error',
      },
    })

    return {
      success: false,
      error: error?.message || 'Failed to send SMS',
    }
  }
}

/**
 * Send reservation confirmation SMS
 */
export async function sendReservationConfirmationSms(
  userId: string,
  reservationId: string,
  phoneNumber: string,
  classDetails: {
    disciplineName: string
    instructorName: string
    dateTime: Date
  }
): Promise<SendSmsResult> {
  const date = classDetails.dateTime.toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const time = classDetails.dateTime.toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const message = `The Wellnest: Tu reserva ha sido confirmada.\n\n${classDetails.disciplineName} con ${classDetails.instructorName}\n${date} a las ${time}\n\nTe esperamos!`

  return sendSms({
    to: phoneNumber,
    message,
    userId,
    reservationId,
    type: 'RESERVATION_CONFIRMATION',
  })
}

/**
 * Send reservation reminder SMS (2 hours before class)
 */
export async function sendReservationReminderSms(
  userId: string,
  reservationId: string,
  phoneNumber: string,
  classDetails: {
    disciplineName: string
    instructorName: string
    dateTime: Date
  }
): Promise<SendSmsResult> {
  const time = classDetails.dateTime.toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const message = `The Wellnest: Recordatorio - Tu clase de ${classDetails.disciplineName} comienza en 2 horas (${time}). Te esperamos!`

  return sendSms({
    to: phoneNumber,
    message,
    userId,
    reservationId,
    type: 'RESERVATION_REMINDER',
  })
}

/**
 * Send cancellation confirmation SMS
 */
export async function sendCancellationSms(
  userId: string,
  reservationId: string,
  phoneNumber: string,
  classDetails: {
    disciplineName: string
    dateTime: Date
  }
): Promise<SendSmsResult> {
  const date = classDetails.dateTime.toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const message = `The Wellnest: Tu reserva de ${classDetails.disciplineName} (${date}) ha sido cancelada. La clase ha sido devuelta a tu paquete.`

  return sendSms({
    to: phoneNumber,
    message,
    userId,
    reservationId,
    type: 'RESERVATION_CANCELLED',
  })
}
