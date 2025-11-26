import { AlertTriangle } from 'lucide-react'

export const metadata = {
  title: 'Términos y Condiciones | The Wellnest',
  description: 'Términos y condiciones de uso de The Wellnest.',
}

export default function TerminosPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-beige to-cream">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-foreground mb-6">
            Términos y Condiciones
          </h1>
          <p className="text-xl text-gray-600">
            Última actualización: Enero 2024
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-4">
          {/* Important Disclaimer */}
          <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)] rounded-2xl p-6 mb-12">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-[var(--color-warning)] flex-shrink-0 mt-1" />
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
                  Aviso Importante - Exención de Responsabilidad
                </h2>
                <p className="text-gray-700">
                  The Wellnest y su personal <strong>NO se hacen responsables</strong> de
                  cualquier daño, lesión o accidente que pueda ocurrir durante la
                  práctica de las actividades ofrecidas en nuestro estudio. Al
                  participar en nuestras clases y actividades, usted asume toda la
                  responsabilidad por su propia seguridad y bienestar físico.
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-lg prose-headings:font-serif prose-headings:text-foreground prose-p:text-gray-600 max-w-none">
            <h2>1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar los servicios de The Wellnest, usted acepta
              estar sujeto a estos términos y condiciones. Si no está de acuerdo
              con alguno de estos términos, le recomendamos no utilizar nuestros
              servicios.
            </p>

            <h2>2. Servicios Ofrecidos</h2>
            <p>
              The Wellnest ofrece clases de bienestar que incluyen, pero no se
              limitan a: Yoga, Pilates Mat, Pole Sport, Sound Healing y consultas
              de Nutrición. Nos reservamos el derecho de modificar, suspender o
              discontinuar cualquier servicio en cualquier momento.
            </p>

            <h2>3. Paquetes y Pagos</h2>
            <h3>3.1 Compra de Paquetes</h3>
            <p>
              Los paquetes de clases pueden ser adquiridos a través de nuestra
              plataforma en línea o directamente en el estudio. Todos los precios
              están expresados en dólares estadounidenses (USD).
            </p>

            <h3>3.2 Vigencia de Paquetes</h3>
            <p>
              Cada paquete tiene una fecha de vencimiento específica que comienza
              a partir de la fecha de compra. Las clases no utilizadas después de
              la fecha de vencimiento no son reembolsables ni transferibles.
            </p>

            <h3>3.3 Política de Reembolsos</h3>
            <p>
              Los paquetes de clases no son reembolsables una vez adquiridos. En
              casos excepcionales y debidamente justificados, podemos ofrecer
              crédito para uso futuro a nuestra discreción.
            </p>

            <h2>4. Reservaciones y Cancelaciones</h2>
            <h3>4.1 Reservaciones</h3>
            <p>
              Las reservaciones pueden realizarse a través de nuestra plataforma
              en línea. Recomendamos reservar con anticipación ya que los cupos
              son limitados.
            </p>

            <h3>4.2 Política de Cancelación</h3>
            <p>
              Las cancelaciones deben realizarse con al menos 4 horas de
              anticipación a la hora de inicio de la clase. Las cancelaciones
              tardías o la no asistencia sin previo aviso resultarán en la pérdida
              de la clase de su paquete.
            </p>

            <h3>4.3 Lista de Espera</h3>
            <p>
              Si una clase está llena, puede unirse a la lista de espera. Será
              notificado si se libera un cupo.
            </p>

            <h2>5. Conducta en el Estudio</h2>
            <p>
              Esperamos que todos los participantes mantengan un comportamiento
              respetuoso hacia los instructores, el personal y otros participantes.
              Nos reservamos el derecho de denegar el servicio a cualquier persona
              que no cumpla con estas normas.
            </p>

            <h2>6. Salud y Seguridad</h2>
            <h3>6.1 Condiciones de Salud</h3>
            <p>
              Es responsabilidad de cada participante consultar con su médico
              antes de comenzar cualquier programa de ejercicio. Debe informar a
              los instructores sobre cualquier condición médica, lesión o
              limitación física.
            </p>

            <h3>6.2 Exención de Responsabilidad</h3>
            <p>
              Al participar en nuestras actividades, usted reconoce que:
            </p>
            <ul>
              <li>
                Las actividades físicas conllevan riesgos inherentes de lesión.
              </li>
              <li>
                The Wellnest no se hace responsable de lesiones, daños o accidentes
                que puedan ocurrir durante las clases o en las instalaciones.
              </li>
              <li>
                Usted participa voluntariamente y asume todos los riesgos
                asociados.
              </li>
              <li>
                Es su responsabilidad conocer sus propios límites y practicar de
                manera segura.
              </li>
            </ul>

            <h2>7. Propiedad Intelectual</h2>
            <p>
              Todo el contenido del sitio web, incluyendo textos, imágenes, logos
              y material audiovisual, es propiedad de The Wellnest y está
              protegido por derechos de autor.
            </p>

            <h2>8. Privacidad</h2>
            <p>
              El uso de su información personal está regido por nuestra Política
              de Privacidad, la cual forma parte integral de estos términos y
              condiciones.
            </p>

            <h2>9. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos y condiciones
              en cualquier momento. Las modificaciones entrarán en vigor
              inmediatamente después de su publicación en nuestro sitio web.
            </p>

            <h2>10. Contacto</h2>
            <p>
              Para cualquier pregunta sobre estos términos y condiciones, puede
              contactarnos a través de:
            </p>
            <ul>
              <li>Email: hola@thewellnest.sv</li>
              <li>Teléfono: +503 1234 5678</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
