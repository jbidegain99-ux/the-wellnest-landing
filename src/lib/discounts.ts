/**
 * Normaliza un código de descuento ingresado por el usuario para que coincida
 * con el formato almacenado en DiscountCode.code (mayúsculas, sin espacios
 * alrededor). Copiar el código desde WhatsApp/Instagram suele arrastrar un
 * espacio o salto de línea al final, lo que hacía fallar la búsqueda exacta.
 */
export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase()
}
