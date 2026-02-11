import nodemailer from 'nodemailer'

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

// Reuse transporter across calls to avoid reconnecting each time
let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  return cachedTransporter
}

async function sendWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  maxRetries: number = 3
): Promise<SendEmailResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions)
      console.log(`[EMAIL] Sent successfully (attempt ${attempt}): ${info.messageId}`)
      return { success: true, messageId: info.messageId }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(`[EMAIL] Attempt ${attempt}/${maxRetries} failed:`, error.message)

      if (attempt === maxRetries) {
        return { success: false, error: error.message }
      }

      // Reset transporter on auth errors to force fresh connection
      if (error.message.includes('535') || error.message.includes('auth')) {
        console.log('[EMAIL] Auth error detected, resetting transporter...')
        cachedTransporter = null
        transporter = getTransporter()
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return { success: false, error: 'Max retries exceeded' }
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<SendEmailResult> {
  const transporter = getTransporter()

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Wellnest" <${process.env.SMTP_USER || 'contact@wellneststudio.net'}>`,
    to,
    subject,
    html,
  }

  return sendWithRetry(transporter, mailOptions)
}

export function buildPasswordResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #E8E0D5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #E8E0D5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 90, 74, 0.08);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #2D5A4A 0%, #4A7A65 100%); padding: 40px 40px 32px; text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 32px; font-weight: 700; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase;">
                WELLNEST
              </h1>
              <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.8); letter-spacing: 1px;">
                Tu santuario de bienestar integral
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #F5F0EB; padding: 40px;">
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #2D5A4A;">
                Hola${name ? ` ${name}` : ''}
              </h2>
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: #5D4E42;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Wellnest.
                Haz clic en el botón de abajo para crear una nueva contraseña.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 4px 0 32px;">
                    <a href="${resetUrl}"
                       target="_blank"
                       style="display: inline-block; background: linear-gradient(135deg, #2D5A4A 0%, #3D6B5A 100%); color: #FFFFFF; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 48px; border-radius: 50px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(45, 90, 74, 0.25);">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; font-size: 13px; line-height: 1.6; color: #888888;">
                Este enlace expirará en <strong style="color: #2D5A4A;">1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
              </p>

              <!-- Fallback link -->
              <div style="background-color: #FFFFFF; border-radius: 10px; padding: 16px 20px; border: 1px solid #E8E0D5;">
                <p style="margin: 0 0 8px; font-size: 12px; color: #888888;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin: 0; font-size: 12px; color: #2D5A4A; word-break: break-all;">
                  ${resetUrl}
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color: #E8E0D5;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #2D5A4A 0%, #3D6B5A 100%); padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 14px; color: #FFFFFF; font-weight: 600; letter-spacing: 1px;">
                WELLNEST STUDIO
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; color: rgba(255,255,255,0.7);">
                contact@wellneststudio.net
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5);">
                &copy; 2026 Wellnest &bull; wellneststudio.net
              </p>
            </td>
          </tr>

        </table>

        <!-- Post-footer note -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #999999; line-height: 1.5;">
                Este correo fue enviado porque se solicitó restablecer la contraseña de tu cuenta.
                Si no fuiste tú, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
