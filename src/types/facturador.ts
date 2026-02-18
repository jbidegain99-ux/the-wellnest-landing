/**
 * Tipos para la integración con Facturador Electrónico SV
 * Cubre tanto el payload de salida (Wellnest → Facturador) como
 * los webhooks de respuesta (Facturador → Wellnest).
 */

// ========================================
// Configuración
// ========================================

export interface FacturadorConfig {
  apiUrl: string
  jwtToken: string // Legacy — inbound endpoint is @Public, auth via HMAC
  tenantId: string
  webhookSecret: string
}

// ========================================
// Payload de salida: Wellnest → Facturador
// ========================================

export interface FacturadorClienteData {
  nombre: string
  email: string
  telefono: string | null
  tipoDocumento: string | null  // "13" (DUI), "36" (NIT), null
  numeroDocumento: string | null
  direccion: string | null
}

export interface FacturadorItemData {
  numeroItem: number
  descripcion: string
  cantidad: number
  precioUnitario: number
  montoDescu: number
  ventaGravada: number
}

export interface FacturadorOutboundPayload {
  event: 'purchase.completed'
  timestamp: string
  tenant_id: string
  correlation_id: string  // purchaseId
  data: {
    tipoDocumento: '01' | '03'  // 01=Factura Consumidor Final, 03=CCF
    montoTotal: number
    montoTotalOperacion: number
    descuentoAplicado: number
    moneda: string
    cliente: FacturadorClienteData
    items: FacturadorItemData[]
    external_reference: string   // purchaseId
    wellnest_user_id: string
    wellnest_package_id: string
    wellnest_credits: number
    metadata: {
      orderId?: string
      environment: string
      tenantName: string
    }
  }
}

// ========================================
// Webhooks de respuesta: Facturador → Wellnest
// ========================================

export type FacturadorWebhookEvent = 'dte.approved' | 'dte.rejected' | 'dte.created'

export interface FacturadorWebhookHeaders {
  'x-webhook-event': FacturadorWebhookEvent
  'x-webhook-signature-256': string
  'x-webhook-timestamp': string
  'x-webhook-delivery': string
}

interface FacturadorClienteResponse {
  nombre: string
  email: string
  telefono?: string
  tipoDocumento?: string
  numeroDocumento?: string
}

interface FacturadorItemResponse {
  numeroItem: number
  descripcion: string
  cantidad: number
  precioUnitario: number
  montoDescu: number
  ventaGravada: number
  tributos?: {
    iva: number
  }
}

interface FacturadorUrls {
  pdf: string
  xml: string
  qr: string
}

interface FacturadorMetadata {
  processingTime?: string
  retryCount?: number
  tenantName?: string
  environment?: string
}

// Evento: dte.approved
export interface DteApprovedData {
  dteId: string
  codigoGeneracion: string
  numeroControl: string
  tipoDocumento: string
  selloRecibido: string
  fechaEmision: string
  fechaAprobacion: string
  estado: 'APROBADO'
  pdf_url: string
  montoTotal: number
  montoTotalOperacion: number
  totalIva: number
  subTotal: number
  descuentoAplicado: number
  moneda: string
  cliente: FacturadorClienteResponse
  external_reference: string
  wellnest_user_id: string
  wellnest_package_id: string
  wellnest_credits: number
  items: FacturadorItemResponse[]
  urls: FacturadorUrls
  metadata: FacturadorMetadata
}

// Evento: dte.rejected
export interface DteRejectedData {
  dteId: string
  codigoGeneracion: string
  numeroControl: string
  tipoDocumento: string
  estado: 'RECHAZADO'
  fechaEmision: string
  fechaRechazo: string
  motivoRechazo: string
  codigoRechazo: string
  descripcionRechazo: string
  external_reference: string
  wellnest_user_id: string
  wellnest_package_id: string
  cliente: FacturadorClienteResponse
  next_actions: string[]
}

// Evento: dte.created
export interface DteCreatedData {
  dteId: string
  codigoGeneracion: string
  estado: 'PROCESANDO'
  fechaEmision: string
  montoTotal: number
  external_reference: string
  wellnest_user_id: string
  estimatedProcessingTime: string
  cliente: FacturadorClienteResponse
  status_url: string
}

// Payloads completos por evento
export interface DteApprovedPayload {
  event: 'dte.approved'
  timestamp: string
  tenant_id: string
  correlation_id: string
  data: DteApprovedData
}

export interface DteRejectedPayload {
  event: 'dte.rejected'
  timestamp: string
  tenant_id: string
  correlation_id: string
  data: DteRejectedData
}

export interface DteCreatedPayload {
  event: 'dte.created'
  timestamp: string
  tenant_id: string
  correlation_id: string
  data: DteCreatedData
}

export type FacturadorWebhookPayload =
  | DteApprovedPayload
  | DteRejectedPayload
  | DteCreatedPayload
