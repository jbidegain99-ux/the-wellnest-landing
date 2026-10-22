import QRCode from 'qrcode'

/** QR en SVG (servidor): módulos oscuros sobre fondo transparente. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1A0F0D', light: '#00000000' } })
}

/** QR en PNG (data URL) para la imagen de vista previa de WhatsApp: oscuro sobre crema. */
export function qrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#1A0F0D', light: '#EFE6D6' } })
}
