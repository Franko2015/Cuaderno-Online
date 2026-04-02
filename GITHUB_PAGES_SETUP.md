# 🚀 Deploy en GitHub Pages - Guía Completa

## 🔑 Paso 1: Configurar Secrets en GitHub

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Clica "New repository secret"
4. Nombre: `GEMINI_API_KEY`
5. Valor: Tu API key de Gemini (`AIzaSyBU31wQt_sryuAlMEg30Db_OTNCBCqa2Mg`)

## 📁 Paso 2: Estructura de Archivos

Tu proyecto ya tiene:
- ✅ `.github/workflows/deploy.yml` - Workflow automatizado
- ✅ `package.json` con script `build:github`
- ✅ Environment variables configuradas
- ✅ `.gitignore` protegiendo archivos sensibles

## 🔧 Paso 3: Configurar GitHub Pages

1. Ve a Settings → Pages en tu repositorio
2. Source: "GitHub Actions"
3. Guarda los cambios

## 📱 Paso 4: Capacitor para Móvil (Opcional)

Para generar la app móvil:

```bash
# Build para mobile
npm run build

# Añadir plataforma Android
npx cap add android

# Sincronizar assets
npx cap sync android

# Abrir en Android Studio
npx cap open android
```

## 🎯 Paso 5: Deploy Automático

Cada vez que hagas push a `main`:
1. GitHub Actions construirá la app
2. La API key se inyectará de forma segura
3. Se deployará automáticamente a GitHub Pages
4. Tu app estará disponible en: `https://[username].github.io/My-Notion`

## 🛡️ Seguridad Implementada

- ✅ API key oculta en GitHub Secrets
- ✅ `.gitignore` protege archivos locales
- ✅ Variables de entorno en producción
- ✅ Build optimizado sin SSR para GitHub Pages

## 🔄 Comandos Útiles

```bash
# Build local para testing
npm run build:github

# Servir localmente la build
npx serve dist/My-Notion/browser

# Verificar environment
echo $GEMINI_API_KEY
```

## 🚨 Importante

- Nunca commits tu `.env` file
- La API key solo está disponible en el workflow
- El deploy es automático al hacer push a main
- La versión mobile usa la misma configuración segura
