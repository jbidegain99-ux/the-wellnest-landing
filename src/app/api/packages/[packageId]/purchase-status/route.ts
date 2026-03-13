import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: { packageId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ alreadyPurchased: false })
  }

  const { packageId } = await params

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { singlePurchaseOnly: true },
  })

  if (!pkg?.singlePurchaseOnly) {
    return NextResponse.json({ alreadyPurchased: false })
  }

  const existing = await prisma.purchase.findFirst({
    where: {
      userId: session.user.id,
      packageId,
    },
    select: { id: true, createdAt: true },
  })

  return NextResponse.json({
    alreadyPurchased: !!existing,
    purchaseDate: existing?.createdAt || null,
  })
}
