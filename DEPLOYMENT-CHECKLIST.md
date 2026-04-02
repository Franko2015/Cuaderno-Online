# 🚀 Checklist de Despliegue en Vercel

## ✅ Configuración Completada

### 1. Archivos de Configuración
- [x] `vercel.json` configurado para SSR
- [x] `package.json` con script `vercel-build`
- [x] `app.routes.server.ts` con rutas dinámicas configuradas
- [x] `server.ts` sin errores de compilación

### 2. Variables de Entorno
- [x] `GEMINI_API_KEY` configurada en README.md
- [x] `environment.prod.ts` en .gitignore (seguro)
- [x] Archivo de ejemplo `environment.example.ts` disponible

## 📋 Pasos para Desplegar

### 1. Configurar Variables de Entorno en Vercel
1. Ve al dashboard de Vercel
2. Entra a tu proyecto
3. Settings → Environment Variables
4. Agrega:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Tu API key real de Gemini
   - **Environment**: Production

### 2. Desplegar
```bash
# Opción 1: Vercel CLI
vercel --prod

# Opción 2: Conectar repositorio Git
# Vercel se desplegará automáticamente en cada push
```

### 3. Verificar Despliegue
- [ ] El sitio carga correctamente
- [ ] Las rutas dinámicas funcionan
- [ ] La API de Gemini responde
- [ ] No hay errores en la consola

## 🔧 Archivos Importantes

- `vercel.json` - Configuración de despliegue
- `src/app/app.routes.server.ts` - Configuración SSR
- `src/server.ts` - Servidor Node.js
- `src/environments/environment.prod.ts` - Variables de producción (gitignored)

## 📝 Notas
- El build genera archivos en `dist/My-Notion/`
- SSR está configurado para renderizar estático las rutas principales
- Rutas dinámicas se renderizan on-demand
- La API key está protegida y no se sube al repositorio
