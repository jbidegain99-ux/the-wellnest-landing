# 🚀 The Wellnest - Guía de Deploy

Esta es la guía completa para publicar **The Wellnest** (landing page estático) en línea de forma gratuita usando GitHub + Netlify o GitHub Pages.

## 📁 Estructura del Proyecto

```
the-wellnest/
├── wellnest-landing/          ← 📂 CARPETA PRINCIPAL PARA HOSTING
│   └── index.html            ← Sitio web completo (landing page)
├── src/                      ← Proyecto Next.js completo (para desarrollo)
├── prisma/                   ← Base de datos y seeds
├── package.json              ← Dependencias del proyecto completo
├── README.md                 ← Documentación del proyecto completo
├── README-DEPLOY.md          ← 📋 ESTA GUÍA (deploy del landing)
├── netlify.toml              ← Configuración para Netlify
└── .gitignore               ← Archivos a ignorar en Git
```

**🎯 Objetivo**: Publicar la carpeta `wellnest-landing/` como un sitio web estático gratuito.

---

## 🌟 OPCIÓN 1: NETLIFY (RECOMENDADO)

Netlify es la forma más fácil y rápida de publicar tu sitio estático.

### Paso 1: Preparar tu código en GitHub

#### 1.1 Crear cuenta en GitHub (si no tienes)
1. Ve a [github.com](https://github.com)
2. Haz clic en "Sign up"
3. Completa el registro con tu email
4. Verifica tu email

#### 1.2 Crear un nuevo repositorio
1. Una vez logueado, haz clic en el botón verde **"New"** (o ve a [github.com/new](https://github.com/new))
2. Nombre del repositorio: `the-wellnest-landing`
3. Descripción: `Landing page estático para The Wellnest - Santuario de Bienestar Integral`
4. Déjalo **Público** (para GitHub Pages gratuito)
5. **NO** marques "Add a README file"
6. Haz clic en **"Create repository"**

#### 1.3 Subir tu código a GitHub
Abre una terminal/command prompt en la carpeta del proyecto y ejecuta estos comandos uno por uno:

```bash
# Verificar que estás en la carpeta correcta
pwd
# Debería mostrar: .../the-wellnest

# Agregar todos los archivos al repositorio
git add .

# Hacer el primer commit
git commit -m "Primer commit: Landing page The Wellnest"

# Conectar con tu repositorio de GitHub
# 🚨 IMPORTANTE: Cambia 'TU_USUARIO' por tu nombre de usuario de GitHub
git remote add origin https://github.com/TU_USUARIO/the-wellnest-landing.git

# Subir el código a GitHub
git push -u origin main
```

**💡 Tip**: Si te pide usuario y contraseña, usa tu username de GitHub y como contraseña usa un [Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token).

### Paso 2: Configurar Netlify

#### 2.1 Crear cuenta en Netlify
1. Ve a [netlify.com](https://netlify.com)
2. Haz clic en **"Sign up"**
3. Selecciona **"GitHub"** para autenticarte con tu cuenta de GitHub
4. Autoriza a Netlify para acceder a tus repositorios

#### 2.2 Desplegar desde GitHub
1. En tu dashboard de Netlify, haz clic en **"Add new site"** → **"Import an existing project"**
2. Selecciona **"GitHub"**
3. Busca y selecciona el repositorio `the-wellnest-landing`
4. Configuración de deploy:
   - **Branch to deploy**: `main`
   - **Base directory**: (dejar vacío)
   - **Build command**: (dejar vacío)
   - **Publish directory**: `wellnest-landing`
5. Haz clic en **"Deploy site"**

#### 2.3 ¡Listo! 🎉
- Netlify generará una URL automática tipo: `https://magical-name-123456.netlify.app`
- El sitio se actualizará automáticamente cada vez que hagas push a GitHub
- Puedes cambiar el nombre del sitio en **Site settings** → **Site details** → **Change site name**

### Paso 3: Personalizar dominio (opcional)
- En **Site settings** → **Domain management** puedes:
  - Cambiar el subdominio de Netlify (ej: `thewellnest.netlify.app`)
  - Conectar tu propio dominio personalizado

---

## 🌐 OPCIÓN 2: GITHUB PAGES

GitHub Pages es otra opción gratuita, ideal si ya tienes el código en GitHub.

### Paso 1: Subir código a GitHub
Sigue los pasos **1.1 a 1.3** de la opción Netlify de arriba.

### Paso 2: Activar GitHub Pages
1. Ve a tu repositorio en GitHub: `https://github.com/TU_USUARIO/the-wellnest-landing`
2. Haz clic en la pestaña **"Settings"** (arriba a la derecha)
3. Baja hasta la sección **"Pages"** (en el menú de la izquierda)
4. En **"Source"** selecciona **"Deploy from a branch"**
5. En **"Branch"** selecciona **"main"**
6. En **"Folder"** selecciona **"/ (root)"** 
7. Haz clic en **"Save"**

### Paso 3: Configurar para subcarpeta
Debido a que nuestro sitio está en `wellnest-landing/`, necesitamos crear un redirect:

1. Crea un archivo `index.html` en la raíz del proyecto:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=./wellnest-landing/">
    <title>Redirecting to The Wellnest</title>
</head>
<body>
    <p>Redirecting to <a href="./wellnest-landing/">The Wellnest</a>...</p>
</body>
</html>
```

2. Haz commit y push:
```bash
git add index.html
git commit -m "Agregar redirect para GitHub Pages"
git push
```

### Paso 4: Acceder a tu sitio
- Tu sitio estará disponible en: `https://TU_USUARIO.github.io/the-wellnest-landing/`
- Puede tomar 5-10 minutos en estar disponible por primera vez

---

## 🚀 OPCIÓN 3: DRAG & DROP (MÁS SIMPLE)

Si no quieres usar GitHub, puedes hacer drag & drop directo en Netlify:

### Paso 1: Preparar carpeta
1. Comprime la carpeta `wellnest-landing/` en un ZIP
   - **Windows**: Click derecho → Enviar a → Carpeta comprimida
   - **Mac**: Click derecho → Comprimir "wellnest-landing"
   - **Linux**: `zip -r wellnest-landing.zip wellnest-landing/`

### Paso 2: Deploy en Netlify
1. Ve a [netlify.com](https://netlify.com) y crea una cuenta
2. En el dashboard, busca la zona que dice **"Want to deploy a new site without connecting to Git?"**
3. Arrastra el archivo ZIP a esa zona
4. ¡Netlify automáticamente desplegará tu sitio!

**💡 Nota**: Con esta opción tendrás que subir manualmente cada vez que hagas cambios.

---

## 🔧 CONFIGURACIÓN AVANZADA

### Variables de entorno (si necesitas)
Si en el futuro necesitas variables de entorno:

**En Netlify**:
- Ve a **Site settings** → **Environment variables**
- Agrega las variables que necesites

**En GitHub Pages**:
- No soporta variables de entorno del servidor
- Solo variables que se compilen en build time

### Dominio personalizado
**En Netlify**:
1. Ve a **Site settings** → **Domain management**
2. Haz clic en **"Add custom domain"**
3. Sigue las instrucciones para configurar DNS

**En GitHub Pages**:
1. En **Settings** → **Pages**
2. En la sección **"Custom domain"** ingresa tu dominio
3. Configura los registros DNS según las instrucciones

---

## 🛠️ COMANDOS ÚTILES

### Para actualizar tu sitio:
```bash
# Hacer cambios en wellnest-landing/index.html
# Luego:
git add .
git commit -m "Actualizar [describe los cambios]"
git push
```

### Para probar localmente:
```bash
# Opción 1: Servidor simple de Python
cd wellnest-landing
python3 -m http.server 8000
# Abre: http://localhost:8000

# Opción 2: Con Node.js (si tienes npx)
npx serve wellnest-landing
# Sigue las instrucciones en terminal
```

### Para clonar en otra máquina:
```bash
git clone https://github.com/TU_USUARIO/the-wellnest-landing.git
```

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### "Permission denied" en git push
**Solución**: Usa un Personal Access Token:
1. Ve a GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Selecciona scopes: `repo`
4. Usa el token como contraseña

### El sitio no se ve bien en móvil
**Solución**: El sitio ya está optimizado para móvil, pero verifica que hayas copiado el archivo completo.

### Los estilos no cargan
**Solución**: Todos los estilos están inline en el HTML, no deberías tener este problema.

### GitHub Pages da 404
**Solución**: 
- Verifica que el archivo `index.html` esté en la raíz o en la carpeta configurada
- Asegúrate de que el repositorio sea público
- Espera 5-10 minutos después de configurar

### Netlify da error de build
**Solución**: 
- Asegúrate de que el directorio de publicación sea `wellnest-landing`
- Deja las configuraciones de build vacías (es un sitio estático)

---

## 📞 SOPORTE

Si tienes problemas:
1. **Netlify**: [docs.netlify.com](https://docs.netlify.com) - Documentación excelente
2. **GitHub Pages**: [pages.github.com](https://pages.github.com) - Guía oficial
3. **Git**: [git-scm.com/docs](https://git-scm.com/docs) - Comandos de Git

---

## ✅ CHECKLIST FINAL

### Antes de presentar al cliente:
- [ ] El sitio carga correctamente en la URL pública
- [ ] Se ve bien en móvil y desktop
- [ ] Todos los enlaces internos funcionan (navegación smooth)
- [ ] Los formularios muestran mensajes apropriados
- [ ] La URL es fácil de recordar (personalizada si es posible)

### URLs de ejemplo para compartir:
- **Netlify**: `https://thewellnest.netlify.app`
- **GitHub Pages**: `https://tuusuario.github.io/the-wellnest-landing/`
- **Dominio personalizado**: `https://thewellnest.com`

---

¡Listo! 🎉 Ahora tienes **The Wellnest** publicado en línea para mostrar a tu cliente. El sitio incluye toda la funcionalidad visual del landing page con diseño responsive y animaciones suaves.