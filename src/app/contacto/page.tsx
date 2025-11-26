'use client'

import * as React from 'react'
import { MapPin, Phone, Mail, Clock, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

const contactInfo = [
  {
    icon: MapPin,
    title: 'Dirección',
    content: 'Av. De La Revolución, San Salvador, Presidente Plaza, Local #1234',
    link: 'https://maps.app.goo.gl/YXoEbMqUfaKGuBPvW',
  },
  {
    icon: Phone,
    title: 'Teléfono',
    content: '+503 7525 2802',
    link: 'tel:+50375252802',
  },
  {
    icon: Mail,
    title: 'Email',
    content: 'hola@thewellnest.sv',
    link: 'mailto:hola@thewellnest.sv',
  },
  {
    icon: Clock,
    title: 'Horario',
    content: 'Lunes a Sábado, 6:00 AM - 8:00 PM',
    link: null,
  },
]

export default function ContactoPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSubmitted, setIsSubmitted] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Contacto
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            ¿Tienes preguntas? Estamos aquí para ayudarte. Contáctanos por
            cualquiera de nuestros canales.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="font-serif text-3xl font-semibold text-foreground mb-8">
                Información de Contacto
              </h2>

              <div className="space-y-6 mb-12">
                {contactInfo.map((item) => {
                  const Icon = item.icon
                  const Content = (
                    <div className="flex gap-4 p-4 bg-white rounded-xl">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-gray-600">{item.content}</p>
                      </div>
                    </div>
                  )

                  return item.link ? (
                    <a
                      key={item.title}
                      href={item.link}
                      target={item.link.startsWith('http') ? '_blank' : undefined}
                      rel={item.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="block hover:scale-[1.02] transition-transform"
                    >
                      {Content}
                    </a>
                  ) : (
                    <div key={item.title}>{Content}</div>
                  )
                })}
              </div>

              {/* WhatsApp CTA */}
              <a
                href="https://wa.me/50375252802"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-6 bg-[#25D366] text-white rounded-xl hover:opacity-90 transition-opacity"
              >
                <MessageCircle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Escríbenos por WhatsApp</p>
                  <p className="text-sm opacity-90">
                    Respuesta rápida en horario de atención
                  </p>
                </div>
              </a>

              {/* Map */}
              <div className="mt-8">
                <div className="h-64 rounded-xl overflow-hidden bg-beige-dark">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3876.4!2d-89.2!3d13.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQyJzAwLjAiTiA4OcKwMTInMDAuMCJX!5e0!3m2!1ses!2ssv!4v1700000000000"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación The Wellnest - Presidente Plaza"
                  />
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h2 className="font-serif text-3xl font-semibold text-foreground mb-8">
                Envíanos un Mensaje
              </h2>

              {isSubmitted ? (
                <div className="bg-white p-8 rounded-2xl text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                    ¡Mensaje Enviado!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Gracias por contactarnos. Te responderemos lo antes posible.
                  </p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">
                    Enviar otro mensaje
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="bg-white p-8 rounded-2xl space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input
                      label="Nombre"
                      name="name"
                      placeholder="Tu nombre"
                      required
                    />
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>

                  <Input
                    label="Teléfono (opcional)"
                    name="phone"
                    type="tel"
                    placeholder="+503 1234 5678"
                  />

                  <Input
                    label="Asunto"
                    name="subject"
                    placeholder="¿En qué podemos ayudarte?"
                    required
                  />

                  <Textarea
                    label="Mensaje"
                    name="message"
                    placeholder="Escribe tu mensaje aquí..."
                    required
                    className="min-h-[150px]"
                  />

                  <Button type="submit" className="w-full" isLoading={isSubmitting}>
                    Enviar Mensaje
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Social Links */}
      <section className="py-16 bg-beige">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">
            Síguenos en Redes Sociales
          </h2>
          <div className="flex justify-center gap-4">
            <a
              href="https://instagram.com/thewellnest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white rounded-full hover:bg-primary/10 transition-colors"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="https://facebook.com/thewellnest"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white rounded-full hover:bg-primary/10 transition-colors"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
