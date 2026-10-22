// Esquemas zod del evento. Sin imports de servidor: los usa también el cliente.
import { z } from 'zod'

const MAX_QTY = 6

export const createOrderInput = z.object({
  name: z.string().trim().min(2, 'Escribí tu nombre completo').max(100, 'Nombre muy largo'),
  phone: z.string().trim().min(4, 'Escribí tu WhatsApp').max(30),
  email: z.string().trim().email('Correo inválido').max(254),
  quantity: z.number().int().min(1).max(MAX_QTY, `Máximo ${MAX_QTY} invitaciones por pedido`),
  marketingOptIn: z.boolean(),
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const claimTicketInput = createOrderInput.omit({ quantity: true })
export type ClaimTicketInput = z.infer<typeof claimTicketInput>
