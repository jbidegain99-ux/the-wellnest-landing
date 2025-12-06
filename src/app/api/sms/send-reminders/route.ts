/**
 * SMS Reminders API
 *
 * This endpoint sends SMS reminders for upcoming class reservations.
 * It should be called by a cron job (e.g., every 15 minutes).
 *
 * Sends reminders 2 hours before class to users who have:
 * 1. SMS reminders enabled
 * 2. A verified phone number
 * 3. An upcoming reservation
 *
 * Security: This endpoint requires an API key to prevent unauthorized access.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReservationReminderSms } from '@/lib/sms'

export async function POST(request: Request) {
  console.log('[SMS REMINDERS] ========== SEND REMINDERS START ==========')
  console.log('[SMS REMINDERS] Timestamp:', new Date().toISOString())

  try {
    // Verify API key for cron job authentication
    const apiKey = request.headers.get('x-api-key')
    const expectedApiKey = process.env.CRON_API_KEY

    // Allow in development mode without API key
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment && (!apiKey || apiKey !== expectedApiKey)) {
      console.log('[SMS REMINDERS] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find classes starting in approximately 2 hours (between 1h45m and 2h15m from now)
    // This gives a 30-minute window for the cron job
    const minTime = new Date(now.getTime() + 105 * 60 * 1000) // 1h45m from now
    const maxTime = new Date(now.getTime() + 135 * 60 * 1000) // 2h15m from now

    console.log('[SMS REMINDERS] Looking for classes between:', {
      minTime: minTime.toISOString(),
      maxTime: maxTime.toISOString(),
    })

    // Find reservations that need reminders
    const reservationsToRemind = await prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        class: {
          dateTime: {
            gte: minTime,
            lte: maxTime,
          },
          isCancelled: false,
        },
      },
      include: {
        user: true,
        class: {
          include: {
            discipline: true,
            instructor: true,
          },
        },
      },
    })

    console.log('[SMS REMINDERS] Found reservations to check:', reservationsToRemind.length)

    const results = {
      total: reservationsToRemind.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const reservation of reservationsToRemind) {
      console.log('[SMS REMINDERS] Processing reservation:', {
        id: reservation.id,
        userId: reservation.userId,
        userEmail: reservation.user.email,
        className: reservation.class.discipline.name,
        classTime: reservation.class.dateTime,
      })

      // Check if user has SMS reminders enabled and a verified phone
      const notificationSettings = await prisma.notificationSettings.findUnique({
        where: { userId: reservation.userId },
      })

      if (!notificationSettings?.smsReminders) {
        console.log('[SMS REMINDERS] SMS reminders not enabled for user:', reservation.userId)
        results.skipped++
        continue
      }

      if (!notificationSettings.phoneNumber || !notificationSettings.phoneVerified) {
        console.log('[SMS REMINDERS] No verified phone for user:', reservation.userId)
        results.skipped++
        continue
      }

      // Check if we already sent a reminder for this reservation
      const existingReminder = await prisma.smsNotification.findFirst({
        where: {
          reservationId: reservation.id,
          type: 'RESERVATION_REMINDER',
          status: { in: ['SENT', 'DELIVERED'] },
        },
      })

      if (existingReminder) {
        console.log('[SMS REMINDERS] Reminder already sent for reservation:', reservation.id)
        results.skipped++
        continue
      }

      // Send the reminder
      const result = await sendReservationReminderSms(
        reservation.userId,
        reservation.id,
        notificationSettings.phoneNumber,
        {
          disciplineName: reservation.class.discipline.name,
          instructorName: reservation.class.instructor.name,
          dateTime: reservation.class.dateTime,
        }
      )

      if (result.success) {
        console.log('[SMS REMINDERS] Reminder sent successfully:', result.messageId)
        results.sent++
      } else {
        console.error('[SMS REMINDERS] Failed to send reminder:', result.error)
        results.failed++
        results.errors.push(`${reservation.id}: ${result.error}`)
      }
    }

    console.log('[SMS REMINDERS] ========== RESULTS ==========')
    console.log('[SMS REMINDERS]', results)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error('[SMS REMINDERS] ========== ERROR ==========')
    console.error('[SMS REMINDERS] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to send reminders',
      },
      { status: 500 }
    )
  }
}

// Also support GET for manual testing in development
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  // Forward to POST handler
  return POST(request)
}
