import { Resend } from 'resend'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'Wellnest <contact@wellneststudio.net>'

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const resend = getResendClient()

    console.log(`[EMAIL] Sending to ${to} via Resend...`)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })

    if (error) {
      console.error(`[EMAIL] Resend error:`, error.message)
      return { success: false, error: error.message }
    }

    console.log(`[EMAIL] Sent successfully: ${data?.id}`)
    return { success: true, messageId: data?.id }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error(`[EMAIL] Failed:`, error.message)
    return { success: false, error: error.message }
  }
}

export interface InvoiceEmailData {
  packageName: string
  invoiceNumber: string
  amount: number
  date: string
  pdfUrl: string
}

export function buildInvoiceEmail(name: string, invoice: InvoiceEmailData): string {
  const formattedAmount = new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
  }).format(invoice.amount)

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Electr&oacute;nica - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Modal card -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px;">

          <!-- Header + Body -->
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: #1F2937; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">Factura Electr&oacute;nica</h1>
              <p style="color: #6B7280; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <!-- Saludo -->
              <p style="color: #374151; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">Hola${name ? ` ${name}` : ''}</p>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                Tu factura electr&oacute;nica ha sido emitida exitosamente. A continuaci&oacute;n encontrar&aacute;s los detalles de tu compra.
              </p>

              <!-- Detalles de factura -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Paquete:</strong> ${invoice.packageName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">No. Factura:</strong> ${invoice.invoiceNumber}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Monto:</strong> ${formattedAmount}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Fecha de emisi&oacute;n:</strong> ${invoice.date}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón descargar PDF -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #86A889; border-radius: 8px;">
                          <a href="${invoice.pdfUrl}"
                             target="_blank"
                             style="display: inline-block; background-color: #86A889; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Descargar Factura PDF
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Link alternativo -->
              <p style="color: #374151; font-size: 13px; font-weight: 500; margin: 24px 0 8px; line-height: 1.4;">Si el bot&oacute;n no funciona, copia este enlace:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #F9FAFB; border-radius: 4px; padding: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; word-break: break-all; font-family: 'Monaco', 'Menlo', monospace;">
                      ${invoice.pdfUrl}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Nota legal -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.4;">
                      Este documento es una factura electr&oacute;nica (DTE) v&aacute;lida emitida conforme a la normativa del Ministerio de Hacienda de El Salvador.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer interno -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                      Wellnest &copy; 2026 &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface GuestInvitationData {
  guestName: string | null
  hostName: string
  disciplineName: string
  instructorName: string
  dateTime: string
  duration: number
  acceptUrl: string
}

export function buildGuestInvitationEmail(data: GuestInvitationData): string {
  const greeting = data.guestName ? `Hola ${data.guestName}` : 'Hola'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitaci&oacute;n a Clase - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Modal card -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px;">

          <!-- Header + Body -->
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: #1F2937; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">Invitaci&oacute;n a Clase</h1>
              <p style="color: #6B7280; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <!-- Saludo -->
              <p style="color: #374151; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">${greeting}</p>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                <strong style="color: #374151;">${data.hostName}</strong> te ha invitado a una clase en Wellnest. &iexcl;Te esperamos!
              </p>

              <!-- Detalles de la clase -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Clase:</strong> ${data.disciplineName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Instructor:</strong> ${data.instructorName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Fecha y hora:</strong> ${data.dateTime}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Duraci&oacute;n:</strong> ${data.duration} minutos
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Ubicaci&oacute;n:</strong> Wellnest Studio
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón aceptar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #86A889; border-radius: 8px;">
                          <a href="${data.acceptUrl}"
                             target="_blank"
                             style="display: inline-block; background-color: #86A889; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Aceptar Invitaci&oacute;n
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Nota -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F0F5F1; border: 1px solid #D4E5D7; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                      No necesitas cuenta para asistir. Haz clic en el bot&oacute;n de arriba para confirmar tu asistencia, o simplemente presenta este email al llegar al estudio.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Link alternativo -->
              <p style="color: #374151; font-size: 13px; font-weight: 500; margin: 24px 0 8px; line-height: 1.4;">Si el bot&oacute;n no funciona, copia este enlace:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #F9FAFB; border-radius: 4px; padding: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; word-break: break-all; font-family: 'Monaco', 'Menlo', monospace;">
                      ${data.acceptUrl}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer interno -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                      Wellnest &copy; 2026 &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface ReservationConfirmationData {
  userName: string | null
  disciplineName: string
  instructorName: string
  dateTime: string
  duration: number
  profileUrl: string
}

export function buildReservationConfirmationEmail(data: ReservationConfirmationData): string {
  const greeting = data.userName ? `Hola ${data.userName}` : 'Hola'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Confirmada - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px;">
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: #1F2937; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">&iexcl;Reserva Confirmada!</h1>
              <p style="color: #6B7280; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <p style="color: #374151; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">${greeting}</p>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                Tu reserva ha sido confirmada. Recuerda llegar unos minutos antes y presentar tu c&oacute;digo QR al llegar al estudio.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Clase:</strong> ${data.disciplineName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Instructor:</strong> ${data.instructorName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Fecha y hora:</strong> ${data.dateTime}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Duraci&oacute;n:</strong> ${data.duration} minutos
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Ubicaci&oacute;n:</strong> Wellnest Studio
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #86A889; border-radius: 8px;">
                          <a href="${data.profileUrl}"
                             target="_blank"
                             style="display: inline-block; background-color: #86A889; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Ver mi C&oacute;digo QR
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F0F5F1; border: 1px solid #D4E5D7; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                      Presenta tu c&oacute;digo QR al llegar al estudio para registrar tu asistencia. Puedes encontrarlo en tu perfil.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                      Wellnest &copy; 2026 &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildPasswordResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Modal card -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px;">

          <!-- Header + Body -->
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: #1F2937; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">Restablecer Contraseña</h1>
              <p style="color: #6B7280; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <!-- Saludo -->
              <p style="color: #374151; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">Hola${name ? ` ${name}` : ''}</p>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Wellnest. Haz clic en el botón de abajo para crear una nueva contraseña.
              </p>

              <!-- Botón centrado -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #86A889; border-radius: 8px;">
                          <a href="${resetUrl}"
                             target="_blank"
                             style="display: inline-block; background-color: #86A889; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Restablecer Contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Info de expiración -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                      <strong style="color: #374151;">Tiempo l&iacute;mite:</strong> Este enlace expirar&aacute; en 1 hora por tu seguridad.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Link alternativo -->
              <p style="color: #374151; font-size: 13px; font-weight: 500; margin: 24px 0 8px; line-height: 1.4;">Si el bot&oacute;n no funciona, copia este enlace:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #F9FAFB; border-radius: 4px; padding: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; word-break: break-all; font-family: 'Monaco', 'Menlo', monospace;">
                      ${resetUrl}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer interno -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                      Wellnest &copy; 2026 &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
