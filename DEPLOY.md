# My-Notion - Deploy en GitHub Pages

## Pasos para Deploy

### 1. Construcción Local
```bash
npm run build:github
```

### 2. Variables de Entorno en GitHub
- Configurar `GEMINI_API_KEY` como secret en GitHub Actions
- URL: https://github.com/Franko2015/Cuaderno-Online/settings/secrets/actions

### 3. Configuración de Environment para Producción
Ya está configurado en `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  geminiApiKey: process.env['GEMINI_API_KEY'] || 'AIzaSyBU31wQt_sryuAlMEg30Db_OTNCBCqa2Mg'
};
```

### 4. Deploy Automático
Cada push a main hará deploy automático a GitHub Pages.

### 5. Features Activadas
- ✅ Build estático optimizado para GitHub Pages
- ✅ API Keys seguras via GitHub Secrets
- ✅ Deploy automático con GitHub Actions
- ✅ Base href configurado para subdirectorio
- ✅ Responsive design para móviles

### 6. URL de Producción
https://franko2015.github.io/Cuaderno-Online

## Comandos Útiles

```bash
# Build local para GitHub Pages
npm run build:github

# Servir localmente para testing
npx serve dist/My-Notion/browser

# Build estándar
npm run build
```

## Configuración de GitHub Pages

1. Ve a Settings → Pages
2. Source: "GitHub Actions"
3. Configura el secret `GEMINI_API_KEY` en Actions secrets

## Deploy para Móvil (Opcional)

```bash
# Build para Capacitor
npm run build

# Sincronizar con Android
npx cap sync android

# Abrir en Android Studio
npx cap open android
```
