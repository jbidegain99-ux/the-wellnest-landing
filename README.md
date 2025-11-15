# The Wellnest - Santuario de Bienestar Integral 🧘‍♀️

Una aplicación web moderna para estudios de bienestar que ofrece yoga, pilates, pole, sound healing, nutrición y más. Construida con Next.js, TypeScript, Prisma y PostgreSQL.

## 🌟 Características

### Funcionalidades Principales
- **Autenticación**: Registro e inicio de sesión con email/contraseña
- **Gestión de Clases**: Sistema completo de disciplinas, coaches y horarios
- **Reservas**: Sistema de booking con gestión de créditos
- **Paquetes**: Venta de paquetes con diferentes cantidades de créditos
- **Pagos**: Integración preparada para Stripe (modo mock incluido)
- **Blog**: Sistema de contenidos para bienestar
- **Panel de Usuario**: Gestión de perfil, créditos e historial

### Disciplinas Incluidas
- 🧘‍♀️ **Yoga**: Vinyasa, Hatha, y más estilos
- 💪 **Pilates**: Mat y reformer
- ⭐ **Pole**: Fitness y artístico
- 🎵 **Sound Healing**: Baños sonoros y meditación
- 🥗 **Nutrición**: Consultas y planes alimentarios

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- PostgreSQL
- npm/yarn/pnpm

### 1. Clonar e instalar dependencias

```bash
# Instalar dependencias
npm install

# O con yarn
yarn install

# O con pnpm
pnpm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

**Variables requeridas:**

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/thewellnest"

# NextAuth
NEXTAUTH_SECRET="tu-clave-secreta-muy-segura"
NEXTAUTH_URL="http://localhost:3000"

# Stripe (opcional para desarrollo)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### 3. Configurar base de datos

```bash
# Crear y aplicar migraciones
npx prisma db push

# Generar cliente Prisma
npx prisma generate

# Poblar con datos de ejemplo
npm run db:seed
```

### 4. Ejecutar la aplicación

```bash
# Modo desarrollo
npm run dev

# Compilar para producción
npm run build
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## 📱 Páginas y Rutas

### Páginas Públicas
- `/` - Página principal con hero y preview de servicios
- `/clases` - Listado de disciplinas y beneficios
- `/equipo` - Perfiles de coaches e instructores
- `/paquetes` - Paquetes disponibles para compra
- `/horarios` - Calendario de clases disponibles
- `/blog` - Blog con contenido de bienestar
- `/galeria` - Galería de fotos del estudio
- `/contacto` - Formulario de contacto

### Autenticación
- `/auth/login` - Inicio de sesión
- `/auth/register` - Registro de usuarios

### Páginas Protegidas
- `/perfil` - Panel de usuario con créditos y reservas
- `/reservar/[classId]` - Reservar clase específica

## 🎨 Diseño y Estilo

### Paleta de Colores
El diseño sigue una estética **minimalista de lujo** con tonos cálidos:

```css
:root {
  --color-bg: #f7f1ea;           /* Fondo principal */
  --color-warm-white: #faf8f5;   /* Blanco cálido */
  --color-primary: #b08968;       /* Café/nude principal */
  --color-accent: #8f9779;        /* Verde suave */
  --color-text: #3b322a;          /* Texto principal */
  --color-nude: #e8dcc6;          /* Nude claro */
  --color-beige: #d4c5a0;         /* Beige */
}
```

### Tipografía
- **Headings**: Playfair Display (serif elegante)
- **Body text**: Inter (sans-serif limpia)

## 🏗️ Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 14 + React + TypeScript
- **Estilos**: Tailwind CSS con variables CSS personalizadas
- **Backend**: API Routes de Next.js
- **Base de datos**: PostgreSQL + Prisma ORM
- **Autenticación**: NextAuth.js
- **Pagos**: Stripe (preparado, modo mock para desarrollo)

### Estructura de Carpetas
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   ├── auth/              # Páginas de autenticación
│   └── ...                # Páginas de la aplicación
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes UI básicos
│   ├── layout/           # Header, Footer, etc.
│   └── sections/         # Secciones de páginas
├── lib/                  # Utilidades y configuraciones
└── types/                # TypeScript definitions
```

## 📊 Modelo de Datos

### Entidades Principales

```typescript
User              // Usuarios del sistema
├── Purchase      // Compras de paquetes
├── UserCredit    // Créditos disponibles
└── Booking       // Reservas de clases

Coach             // Instructores
├── CoachDiscipline // Relación coach-disciplina
└── ClassSession    // Clases que imparte

Discipline        // Yoga, Pilates, etc.
├── ClassSession  // Clases de la disciplina
└── Package       // Paquetes que incluyen la disciplina

ClassSession      // Clases individuales
└── Booking       // Reservas de la clase

Package           // Paquetes de créditos
└── Purchase      // Compras del paquete
```

## 🔗 APIs Principales

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Inicio de sesión (NextAuth)

### Contacto y Newsletter
- `POST /api/contact` - Envío de formulario de contacto
- `POST /api/newsletter` - Suscripción a newsletter

### Funcionalidades por Implementar
- `GET /api/classes` - Listado de clases
- `POST /api/bookings` - Crear reserva
- `GET /api/packages` - Listado de paquetes
- `POST /api/purchases` - Comprar paquete
- `POST /api/payments/stripe` - Procesar pago con Stripe

## 🚀 Próximos Pasos para Producción

### 1. Integración de Pagos
Configurar Stripe para pagos reales:

```typescript
// En src/lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})
```

### 2. Personalización de Marca
Actualizar en `src/app/globals.css`:

```css
:root {
  /* Actualizar con tu paleta de colores específica */
  --color-primary: #tu-color-primario;
  --color-accent: #tu-color-acento;
}
```

### 3. Configuración de Dominio
Actualizar `NEXTAUTH_URL` y otras URLs en variables de entorno.

### 4. Email Marketing
Integrar con servicio de email (SendGrid, Mailchimp, etc.) en:
- `src/app/api/newsletter/route.ts`
- `src/app/api/contact/route.ts`

## 🎯 Usuario Demo

Para probar la aplicación, usa estas credenciales:

```
Email: demo@thewellnest.com
Password: password123
```

## 🤝 Desarrollo

### Comandos Útiles

```bash
# Reiniciar base de datos
npx prisma db push --force-reset
npm run db:seed

# Ver base de datos
npx prisma studio

# Linting
npm run lint

# Generar tipos Prisma
npx prisma generate
```

### Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

---

**The Wellnest** - Creando espacios de bienestar integral 🌿