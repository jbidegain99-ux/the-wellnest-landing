'use client'

import * as React from 'react'
import { Gift, Copy, Share2, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// Mock referral data
const referralData = {
  code: 'MARIA2024',
  link: 'https://thewellnest.sv/r/MARIA2024',
  classesEarned: 2,
  friendsReferred: 3,
  pendingReferrals: 1,
}

const referralHistory = [
  {
    id: '1',
    friendName: 'Ana López',
    date: '2024-01-10',
    status: 'completed',
    classesEarned: 1,
  },
  {
    id: '2',
    friendName: 'Laura Martínez',
    date: '2024-01-05',
    status: 'completed',
    classesEarned: 1,
  },
  {
    id: '3',
    friendName: 'Sofia Chen',
    date: '2024-01-15',
    status: 'pending',
    classesEarned: 0,
  },
]

export default function InvitacionesPage() {
  const [copied, setCopied] = React.useState(false)

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(referralData.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralData.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'The Wellnest - Tu santuario de bienestar',
          text: '¡Únete a The Wellnest con mi código y recibe un descuento!',
          url: referralData.link,
        })
      } catch (err) {
        console.log('Error sharing:', err)
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Programa de Referidos
        </h1>
        <p className="text-gray-600 mt-1">
          Invita a tus amigos y gana clases gratis
        </p>
      </div>

      {/* How it works */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-none">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-full">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                ¿Cómo funciona?
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Comparte tu código o link con tus amigos</li>
                <li>Cuando tu amigo se registre y compre su primer paquete</li>
                <li>
                  ¡Tú recibes <strong>1 clase gratis</strong> y tu amigo recibe{' '}
                  <strong>10% de descuento</strong>!
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-serif font-semibold text-primary">
              {referralData.classesEarned}
            </p>
            <p className="text-sm text-gray-600">Clases ganadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-serif font-semibold text-primary">
              {referralData.friendsReferred}
            </p>
            <p className="text-sm text-gray-600">Amigos referidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-serif font-semibold text-accent">
              {referralData.pendingReferrals}
            </p>
            <p className="text-sm text-gray-600">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code */}
      <Card>
        <CardHeader>
          <CardTitle>Tu Código de Referido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                value={referralData.code}
                readOnly
                className="text-center font-mono text-lg font-semibold"
              />
            </div>
            <Button onClick={handleCopyCode} variant="outline">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleCopyLink} variant="outline" className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
            <Button onClick={handleShare} className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Historial de Referidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referralHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aún no has referido a nadie. ¡Comparte tu código!
            </p>
          ) : (
            <div className="space-y-4">
              {referralHistory.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between py-3 border-b border-beige last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {referral.friendName}
                    </p>
                    <p className="text-sm text-gray-500">{referral.date}</p>
                  </div>
                  <div className="text-right">
                    {referral.status === 'completed' ? (
                      <>
                        <Badge variant="success">Completado</Badge>
                        <p className="text-sm text-primary mt-1">
                          +{referral.classesEarned} clase
                        </p>
                      </>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
