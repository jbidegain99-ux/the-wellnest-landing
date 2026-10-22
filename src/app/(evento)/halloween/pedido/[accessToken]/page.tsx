import type { Metadata } from 'next'
import { OrderPage } from '@/components/evento/OrderPage'

export const dynamic = 'force-dynamic'
// Alias: los primeros correos de The Villains Ball apuntan acá
export const metadata: Metadata = { title: 'Tu pedido · Wellnest', robots: { index: false, follow: false } }

export default async function HalloweenPedidoPage({ params }: { params: Promise<{ accessToken: string }> }) {
  const { accessToken } = await params
  return <OrderPage accessToken={accessToken} />
}
